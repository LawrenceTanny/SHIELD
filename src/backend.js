import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';

dotenv.config();
const app = express();
app.use(cors()); 
app.use(express.json()); 

const client = new MongoClient(process.env.MONGO_URI);

let usersCollection;
let dbInstance;
let alertLogsCollection;
let disasterCacheCollection;
let reverseGeocodeCollection;

let cachedDisastersPayload = null;
let cachedDisastersFetchedAt = 0;
const disasterCacheTtlMs = Number(process.env.DISASTER_CACHE_TTL_MS || 10 * 60 * 1000);

const reverseGeocodeMemoryCache = new Map();
const reverseGeocodeMinDelayMs = Number(process.env.REVERSE_GEOCODE_MIN_DELAY_MS || 5000);
let reverseGeocodeQueue = Promise.resolve();
let lastReverseGeocodeAt = 0;

const ALERT_POLL_INTERVAL_MS = Number(process.env.ALERT_POLL_INTERVAL_MS || 5 * 60 * 1000);
const ENABLE_AUTO_ALERTS = String(process.env.ENABLE_AUTO_ALERTS || 'false').toLowerCase() === 'true';

let lastAutoAlertRun = {
  ranAt: null,
  success: false,
  disastersChecked: 0,
  alertsSent: 0,
  skippedExisting: 0,
  skippedNoRecipients: 0,
  error: null
};

const PROVINCE_KEYWORDS = {
  'Bulacan': ['bulacan', 'malolos', 'meycauayan', 'san jose del monte', 'marilao'],
  'Albay': ['albay', 'legazpi', 'tabaco', 'ligao', 'daraga'],
  'Camarines Sur': ['camarines sur', 'naga', 'iriga', 'cam sur'],
  'Sorsogon': ['sorsogon', 'sorsogon city'],
  'Batangas': ['batangas', 'lipa', 'tanauan', 'nasugbu', 'taal', 'agoncillo', 'hukay', 'lemery', 'balayan', 'bauan', 'calaca', 'san nicolas'],
  'Cebu': ['cebu', 'cebu city', 'mandaue', 'lapu-lapu'],
  'Iloilo': ['iloilo', 'iloilo city'],
  'Leyte': ['leyte', 'tacloban'],
  'Misamis Oriental': ['misamis oriental', 'cagayan de oro'],
  'Davao del Sur': ['davao', 'davao city'],
  'South Cotabato': ['general santos', 'gensan', 'south cotabato'],
  'Negros Occidental': ['negros occidental', 'bacolod', 'canlaon']
};

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMatchedProvinces(disaster) {
  const sourceText = `${disaster?.city || ''} ${disaster?.title || ''}`.toLowerCase();
  const matched = [];

  for (const [province, keywords] of Object.entries(PROVINCE_KEYWORDS)) {
    if (keywords.some((kw) => sourceText.includes(kw))) {
      matched.push(province);
    }
  }

  return matched;
}

function buildProvinceRegex(province) {
  const escapedProvince = escapeRegex(province);
  return new RegExp(`(^|\\b)${escapedProvince}(\\b|$)|${escapedProvince}\\s+province`, 'i');
}

function normalizeLocationLabel(place) {
  if (!place) return 'Unknown location';

  const stripped = String(place)
    .replace(/^\d+(?:\.\d+)?\s*km\s+[A-Z]{1,3}\s+of\s+/i, '')
    .replace(/,\s*Philippines\s*$/i, '')
    .trim();

  return stripped || String(place).trim();
}

function shouldReverseGeocodeDisaster(disaster) {
  const label = `${disaster?.city || ''} ${disaster?.rawLocation || ''}`.toLowerCase();
  return !disaster?.province || /philippines area|unknown location/.test(label);
}

function formatReverseGeocodedLabel(reverseGeocodeResult, fallbackLabel) {
  if (!reverseGeocodeResult) return fallbackLabel;

  const province = reverseGeocodeResult.province || null;
  const city = reverseGeocodeResult.city || null;

  if (city && province) {
    return city.toLowerCase().includes(province.toLowerCase()) ? city : `${city}, ${province}`;
  }

  if (city) return city;
  if (province) return province;
  return fallbackLabel;
}

function attachProvinceHint(disaster) {
  const matchedProvinces = extractMatchedProvinces(disaster);
  const province = matchedProvinces[0] || null;
  const cityText = String(disaster.city || '').trim();

  if (!province) {
    return {
      ...disaster,
      province: null,
      matchedProvinces: matchedProvinces
    };
  }

  const provinceRegex = buildProvinceRegex(province);
  const locationLabel = provinceRegex.test(cityText) ? cityText : `${cityText}, ${province}`;

  return {
    ...disaster,
    city: locationLabel,
    province,
    matchedProvinces: matchedProvinces
  };
}

async function enrichDisasterLocation(disaster) {
  const reverseGeocodeResult = shouldReverseGeocodeDisaster(disaster)
    ? await reverseGeocodeCoordinates(disaster.lat, disaster.lng)
    : null;

  const matchedProvinces = extractMatchedProvinces(disaster);
  const reverseProvince = reverseGeocodeResult?.province || null;
  const reverseCity = reverseGeocodeResult?.city || null;
  const province = reverseProvince || matchedProvinces[0] || disaster.province || null;
  const city = formatReverseGeocodedLabel(reverseGeocodeResult, disaster.city || 'Unknown location');
  const locationLabel = province && !city.toLowerCase().includes(province.toLowerCase())
    ? `${city}, ${province}`
    : city;

  return {
    ...disaster,
    city: locationLabel,
    province,
    cityName: reverseCity || disaster.city || null,
    reverseGeocode: reverseGeocodeResult,
    matchedProvinces: matchedProvinces.length > 0 ? matchedProvinces : (province ? [province] : [])
  };
}

async function getDatabase() {
  if (dbInstance) return dbInstance;
  await client.connect();
  dbInstance = client.db('shield_db');
  return dbInstance;
}

async function getUsersCollection() {
  if (usersCollection) return usersCollection;
  const db = await getDatabase();
  usersCollection = db.collection('users');
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  return usersCollection;
}

async function getAlertLogsCollection() {
  if (alertLogsCollection) return alertLogsCollection;
  const db = await getDatabase();
  alertLogsCollection = db.collection('alert_logs');
  await alertLogsCollection.createIndex({ disasterId: 1, province: 1 }, { unique: true });
  await alertLogsCollection.createIndex({ createdAt: -1 });
  return alertLogsCollection;
}

async function getDisasterCacheCollection() {
  if (disasterCacheCollection) return disasterCacheCollection;
  const db = await getDatabase();
  disasterCacheCollection = db.collection('disaster_cache');
  await disasterCacheCollection.createIndex({ fetchedAt: -1 });
  return disasterCacheCollection;
}

async function getReverseGeocodeCollection() {
  if (reverseGeocodeCollection) return reverseGeocodeCollection;
  const db = await getDatabase();
  reverseGeocodeCollection = db.collection('reverse_geocode_cache');
  await reverseGeocodeCollection.createIndex({ cacheKey: 1 }, { unique: true });
  await reverseGeocodeCollection.createIndex({ updatedAt: -1 });
  return reverseGeocodeCollection;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCoordinateCacheKey(lat, lng) {
  return `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`;
}

async function getCachedDisastersPayload() {
  if (cachedDisastersPayload && cachedDisastersFetchedAt && Date.now() - cachedDisastersFetchedAt < disasterCacheTtlMs) {
    return cachedDisastersPayload;
  }

  const collection = await getDisasterCacheCollection();
  const cached = await collection.findOne({ _id: 'latest' });

  if (cached?.data && cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < disasterCacheTtlMs) {
    cachedDisastersPayload = cached.data;
    cachedDisastersFetchedAt = new Date(cached.fetchedAt).getTime();
    return cachedDisastersPayload;
  }

  return null;
}

async function setCachedDisastersPayload(data) {
  cachedDisastersPayload = data;
  cachedDisastersFetchedAt = Date.now();

  const collection = await getDisasterCacheCollection();
  await collection.updateOne(
    { _id: 'latest' },
    {
      $set: {
        data,
        fetchedAt: new Date(cachedDisastersFetchedAt)
      }
    },
    { upsert: true }
  );
}

async function reverseGeocodeCoordinates(lat, lng) {
  const cacheKey = getCoordinateCacheKey(lat, lng);

  if (reverseGeocodeMemoryCache.has(cacheKey)) {
    return reverseGeocodeMemoryCache.get(cacheKey);
  }

  const collection = await getReverseGeocodeCollection();
  const cached = await collection.findOne({ cacheKey });
  if (cached?.result) {
    reverseGeocodeMemoryCache.set(cacheKey, cached.result);
    return cached.result;
  }

  reverseGeocodeQueue = reverseGeocodeQueue.catch(() => null).then(async () => {
    if (reverseGeocodeMemoryCache.has(cacheKey)) {
      return reverseGeocodeMemoryCache.get(cacheKey);
    }

    const queuedCached = await collection.findOne({ cacheKey });
    if (queuedCached?.result) {
      reverseGeocodeMemoryCache.set(cacheKey, queuedCached.result);
      return queuedCached.result;
    }

    const elapsed = Date.now() - lastReverseGeocodeAt;
    if (elapsed < reverseGeocodeMinDelayMs) {
      await sleep(reverseGeocodeMinDelayMs - elapsed);
    }

    lastReverseGeocodeAt = Date.now();

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=10`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': `SHIELD/1.0 (${process.env.NODEMAILER_EMAIL || 'shield-app'})`,
        'Accept': 'application/json',
        'Accept-Language': 'en'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim reverse geocode failed with status ${response.status}`);
    }

    const data = await response.json();
    const address = data.address || {};

    const result = {
      province: address.state || address.state_district || address.region || address.county || null,
      city: address.city || address.town || address.village || address.municipality || address.hamlet || address.suburb || address.locality || null,
      displayName: data.display_name || null,
      source: 'nominatim'
    };

    reverseGeocodeMemoryCache.set(cacheKey, result);
    await collection.updateOne(
      { cacheKey },
      {
        $set: {
          cacheKey,
          result,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    return result;
  }).catch((error) => {
    console.warn('Reverse geocode failed:', error?.message || error);
    return null;
  });

  return reverseGeocodeQueue;
}

async function fetchLiveDisastersData() {
  const cachedDisasters = await getCachedDisastersPayload();
  if (cachedDisasters) {
    return cachedDisasters;
  }

  const usgsUrl = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=4.5&maxlatitude=21.5&minlongitude=116.9&maxlongitude=126.6&minmagnitude=5.0&orderby=time&limit=10';
  const nasaUrl = 'https://eonet.gsfc.nasa.gov/api/v3/events?bbox=116.9,4.5,126.6,21.5&status=open';
  const requestTimeoutMs = 15000;

  const fetchJsonWithTimeout = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const [usgsResult, nasaResult] = await Promise.allSettled([
    fetchJsonWithTimeout(usgsUrl),
    fetchJsonWithTimeout(nasaUrl)
  ]);

  const usgsData = usgsResult.status === 'fulfilled' ? usgsResult.value : null;
  const nasaData = nasaResult.status === 'fulfilled' ? nasaResult.value : null;

  const allDisasters = [];
  if (usgsData.features) {
    for (const quake of usgsData.features) {
      const mag = quake.properties.mag;
      const severityLevel = mag >= 6.0 ? 'High' : 'Medium';
      const dateObj = new Date(quake.properties.time);
      const rawLocation = quake.properties.place;
      const normalizedLocation = normalizeLocationLabel(rawLocation);

      const normalizedDisaster = await enrichDisasterLocation(attachProvinceHint({
        id: quake.id,
        type: 'Earthquake',
        title: `Magnitude ${mag}`,
        severity: severityLevel,
        city: normalizedLocation,
        rawLocation,
        lat: quake.geometry.coordinates[1],
        lng: quake.geometry.coordinates[0],
        source: 'USGS',
        updatedAt: dateObj.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
        status: 'Active'
      }));

      allDisasters.push(normalizedDisaster);
    }
  }

  if (usgsResult.status === 'rejected') {
    console.warn('USGS disaster fetch failed:', usgsResult.reason?.message || usgsResult.reason);
  }

  if (nasaData.events) {
    for (const event of nasaData.events) {
      const latestGeo = event.geometry[event.geometry.length - 1];

      let eventType = 'General Disaster';
      const categoryId = event.categories[0].id;

      if (categoryId === 'severeStorms') eventType = 'Typhoon';
      else if (categoryId === 'volcanoes') eventType = 'Volcanic Activity';
      else if (categoryId === 'wildfires') eventType = 'Fire';
      else if (categoryId === 'floods') eventType = 'Flood';
      else if (categoryId === 'landslides') eventType = 'Landslide';

      const dateObj = new Date(latestGeo.date);

      const normalizedDisaster = await enrichDisasterLocation(attachProvinceHint({
        id: event.id,
        type: eventType,
        title: event.title,
        severity: 'High',
        city: 'Philippines Area',
        rawLocation: event.title,
        lat: latestGeo.coordinates[1],
        lng: latestGeo.coordinates[0],
        source: 'NASA EONET',
        updatedAt: dateObj.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
        status: 'Active'
      }));

      allDisasters.push(normalizedDisaster);
    }
  }

  if (nasaResult.status === 'rejected') {
    console.warn('NASA disaster fetch failed:', nasaResult.reason?.message || nasaResult.reason);
  }

  await setCachedDisastersPayload(allDisasters);

  return allDisasters;
}

// POST METHOD, INSERTS DATA TO DATABAS, SIR NEIL TINANGGAL KO NA MGA EMOJI BAKA SABIHIN MO AI NANAMAN HAYSSS:<
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, province, city } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!name || !normalizedEmail || !password || !province || !city) {
      return res.status(400).json({ message: "Missing required signup fields." });
    }

    const usersCollection = await getUsersCollection();
    const existingUser = await usersCollection.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ message: "Email already exists. Please sign in instead." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await usersCollection.insertOne({
      name: name,
      email: normalizedEmail,
      password: hashedPassword, 
      location: {
        province: province,
        city: city
      },
      accountStatus: 'Active',
      signupDate: new Date()
    });

    res.status(201).json({ message: "User successfully registered!", data: result });

  } catch (error) {
    console.error(error);
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Email already exists. Please sign in instead." });
    }
    res.status(500).json({ message: "Something went wrong saving the user." });
  }
});

//GET method, GETS DATAS FROM DATABASE
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    const usersCollection = await getUsersCollection();

    const user = await usersCollection.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: "Account not found. Please register first." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password. Please try again." });
    }
    res.status(200).json({ 
      message: "Login successful!", 
      user: {
        name: user.name,
        email: user.email,
        province: user.location.province,
        city: user.location.city
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during login." });
  }
});

app.get('/api/disasters', async (req, res) => {// DISASTERS API, earthquake from USGS, nasa for Volcano, Typhoon, Landslide from EONET
  try {
    const allDisasters = await fetchLiveDisastersData();
    res.status(200).json(allDisasters);

  } catch (error) {
    console.error("Error fetching live disaster data:", error);
    res.status(500).json({ message: "Failed to fetch live disaster data." });
  }
});

// API PARA SA LATEST NEWS HEHE EWAN KO SA KAGROUP KO BAT SINAMA PERO SIGE NALANG DAGDAG GAWAIN
let cachedNews = null;
let lastNewsFetchTime = 0;

app.get('/api/news', async (req, res) => {
  try {
    const apiKey = process.env.MEDIASTACK_API_KEY; 
    const currentTime = Date.now();
    const twelveHours = 12 * 60 * 60 * 1000; 

    if (cachedNews && (currentTime - lastNewsFetchTime < twelveHours)) {
      console.log("Serving news from Backend Cache!");
      return res.status(200).json(cachedNews);
    }

    console.log("Cache empty. Fetching fresh news...");

    // Working API pero 100 per month lang kaya hardcode muna pang testing.
    /*
    if (!apiKey) return res.status(500).json({ message: "News API key missing." });
    const url = `http://api.mediastack.com/v1/news?access_key=${apiKey}&countries=ph&keywords=typhoon,earthquake,flood,volcano,disaster&limit=5`;
    const response = await fetch(url);
    const data = await response.json();

    let cleanNews = [];
    if (data.data) {
      cleanNews = data.data.map(article => ({
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source,
        image: article.image || "https://via.placeholder.com/150", 
        publishedAt: new Date(article.published_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })
      }));
    } else {
      return res.status(404).json({ message: "No news found." });
    }
      */
    const cleanNews = [
      {
        title: "Magnitude 6.2 Earthquake Strikes Off the Coast of Mindanao",
        description: "PHIVOLCS reports a strong tectonic earthquake. No tsunami warning has been issued, but aftershocks are expected in the coming days.",
        url: "https://www.phivolcs.dost.gov.ph/",
        source: "Mock News Network",
        image: "https://via.placeholder.com/150/ff4d6d/ffffff?text=Quake+Alert",
        publishedAt: new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })
      },
      {
        title: "Typhoon Basyang Enters PAR, Signal No. 2 Raised in Visayas",
        description: "PAGASA warns residents of coastal areas to prepare for potential storm surges and heavy rainfall starting tomorrow evening.",
        url: "https://bagong.pagasa.dost.gov.ph/",
        source: "Mock Weather Bureau",
        image: "https://via.placeholder.com/150/0077b6/ffffff?text=Typhoon+Update",
        publishedAt: new Date(Date.now() - 86400000).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) // Yesterday
      },
      {
        title: "Mayon Volcano Status Alert Level Raised to 3",
        description: "Increased seismic activity and crater glow observed. Evacuation of the 6km permanent danger zone is strictly enforced.",
        url: "https://www.phivolcs.dost.gov.ph/",
        source: "Mock News Network",
        image: "https://via.placeholder.com/150/ff9f1c/ffffff?text=Volcano+Alert",
        publishedAt: new Date(Date.now() - 172800000).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) // 2 days ago
      }
    ];

    cachedNews = cleanNews;
    lastNewsFetchTime = currentTime;

    res.status(200).json(cachedNews);

  } catch (error) {
    console.error("Error fetching news:", error);
    if (cachedNews) {
      res.status(200).json(cachedNews);
    } else {
      res.status(500).json({ message: "Failed to fetch news data." });
    }
  }
});

// API PARA SA PHILIPHINE WEATHER, SA FRONT END KO NA AAYUSIN.
app.get('/api/weather', async (req, res) => {
  const PH_WEATHER_POINTS = [
    { name: 'Laoag', lat: 18.1978, lng: 120.5952 },
    { name: 'Baguio', lat: 16.4023, lng: 120.5960 },
    { name: 'Manila', lat: 14.5995, lng: 120.9842 },
    { name: 'Legazpi', lat: 13.1391, lng: 123.7438 },
    { name: 'Cebu', lat: 10.3157, lng: 123.8854 },
    { name: 'Iloilo', lat: 10.7202, lng: 122.5621 },
    { name: 'Tacloban', lat: 11.2433, lng: 125.0040 },
    { name: 'Cagayan de Oro', lat: 8.4542, lng: 124.6319 },
    { name: 'Davao', lat: 7.1907, lng: 125.4553 },
    { name: 'General Santos', lat: 6.1164, lng: 125.1716 }
  ];

  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY; 
    
    if (!apiKey) {
      return res.status(500).json({ message: "Weather API key missing." });
    }

    const requests = PH_WEATHER_POINTS.map((point) => {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${point.lat}&lon=${point.lng}&appid=${apiKey}&units=metric`;
      return fetch(url)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) return null;

          return {
            id: String(data.id || point.name.toLowerCase().replace(/\s+/g, '-')),
            name: point.name,
            city: data.name || point.name,
            lat: data.coord?.lat ?? point.lat,
            lng: data.coord?.lon ?? point.lng,
            temp_c: typeof data.main?.temp === 'number' ? Math.round(data.main.temp) : null,
            weather: data.weather?.[0]?.main || 'Weather',
            description: data.weather?.[0]?.description || '',
            humidity: data.main?.humidity ?? null,
            icon: data.weather?.[0]?.icon
              ? `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
              : null
          };
        })
        .catch(() => null);
    });

    const settled = await Promise.all(requests);
    const stations = settled.filter(Boolean);

    if (stations.length === 0) {
      return res.status(502).json({ message: 'Weather providers unavailable right now.' });
    }

    return res.status(200).json({
      source: 'openweathermap-ph',
      fetchedAt: new Date().toISOString(),
      stations,
      coverage: 'philippines'
    });

  } catch (error) {
    console.error("Error fetching weather:", error);
    res.status(500).json({ message: "Failed to fetch local weather." });
  }
});


// EMAILER BACKEND.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASS  
  }
});

app.post('/api/admin/alert', async (req, res) => {
  try {
    const { targetProvince, disasterType, message } = req.body;
    if (!targetProvince || !disasterType || !message) {
      return res.status(400).json({ message: "Missing alert details." });
    }
    const usersCollection = await getUsersCollection();
    const affectedUsers = await usersCollection.find({ 
      "location.province": targetProvince 
    }).toArray();
    if (affectedUsers.length === 0) {
      return res.status(404).json({ message: `No users registered in ${targetProvince}.` });
    }
    const emailList = affectedUsers.map(user => user.email);
    const mailOptions = {
      from: `"SHIELD Emergency System" <${process.env.NODEMAILER_EMAIL}>`,
      bcc: emailList, 
      subject: `🚨 SHIELD ALERT: ${disasterType} Warning for ${targetProvince}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #ff4d4d; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #ff4d4d; color: white; padding: 15px; text-align: center;">
            <h2 style="margin: 0;">EMERGENCY ADVISORY</h2>
          </div>
          <div style="padding: 20px; background-color: #fff9f9;">
            <p style="font-size: 16px; margin-bottom: 5px;"><strong>📍 Affected Area:</strong> ${targetProvince}</p>
            <p style="font-size: 16px; margin-top: 0;"><strong>⚠️ Hazard Type:</strong> ${disasterType}</p>
            <hr style="border: 1px solid #ffcccc; margin: 20px 0;"/>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">${message}</p>
            <br/>
            <p style="font-size: 12px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 10px;">
              Stay safe. This is an automated priority message from the SHIELD Disaster Dashboard.
            </p>
          </div>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
    console.log(`Alert successfully sent to ${emailList.length} users in ${targetProvince}`);

    res.status(200).json({ 
      message: `Success! Alert sent to ${emailList.length} residents in ${targetProvince}.` 
    });

  } catch (error) {
    console.error("Error sending email alerts:", error);
    res.status(500).json({ message: "Failed to send emergency alerts." });
  }
});

async function sendAutoAlertsForCurrentDisasters() {
  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASS) {
    lastAutoAlertRun = {
      ranAt: new Date().toISOString(),
      success: false,
      disastersChecked: 0,
      alertsSent: 0,
      skippedExisting: 0,
      skippedNoRecipients: 0,
      error: 'Missing NODEMAILER_EMAIL or NODEMAILER_PASS'
    };
    return;
  }

  try {
    const disasters = await fetchLiveDisastersData();
    if (!Array.isArray(disasters) || disasters.length === 0) {
      return;
    }

    const users = await getUsersCollection();
    const alertLogs = await getAlertLogsCollection();
    let alertsSent = 0;
    let skippedExisting = 0;
    let skippedNoRecipients = 0;

    for (const disaster of disasters) {
      const provinces = extractMatchedProvinces(disaster);
      if (provinces.length === 0) continue;

      for (const province of provinces) {
        const alreadySent = await alertLogs.findOne({
          disasterId: disaster.id,
          province,
          source: 'auto-alert'
        });
        if (alreadySent) {
          skippedExisting += 1;
          continue;
        }

        const provinceRegex = buildProvinceRegex(province);
        const recipients = await users.find({
          accountStatus: 'Active',
          'location.province': { $regex: provinceRegex }
        }).toArray();

        if (recipients.length === 0) {
          skippedNoRecipients += 1;
          continue;
        }

        const emailList = recipients.map((user) => user.email).filter(Boolean);
        if (emailList.length === 0) continue;

        // If a prior run had no recipients for this disaster/province, clear it so this run can store an auto-alert log.
        await alertLogs.deleteMany({
          disasterId: disaster.id,
          province,
          source: 'auto-no-recipients'
        });

        const mailOptions = {
          from: `"SHIELD Emergency System" <${process.env.NODEMAILER_EMAIL}>`,
          bcc: emailList,
          subject: `SHIELD ALERT: ${disaster.type} warning for ${province}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 2px solid #ff4d4d; border-radius: 10px; overflow: hidden;">
              <div style="background-color: #ff4d4d; color: white; padding: 14px; text-align: center;">
                <h2 style="margin: 0;">EMERGENCY ADVISORY</h2>
              </div>
              <div style="padding: 20px; background-color: #fff9f9; color: #222;">
                <p style="font-size: 16px; margin-bottom: 6px;"><strong>Affected Province:</strong> ${province}</p>
                <p style="font-size: 16px; margin-top: 0;"><strong>Hazard Type:</strong> ${disaster.type}</p>
                <p style="font-size: 15px;"><strong>Alert:</strong> ${disaster.title}</p>
                <p style="font-size: 14px; color: #555;">Location detail: ${disaster.city}</p>
                <p style="font-size: 14px; color: #555;">Source: ${disaster.source}</p>
                <hr style="border: 1px solid #ffcccc; margin: 18px 0;" />
                <p style="font-size: 14px; line-height: 1.6; margin: 0;">Stay alert and monitor official advisories. This is an automated notification from SHIELD.</p>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        alertsSent += 1;

        await alertLogs.insertOne({
          disasterId: disaster.id,
          province,
          recipientsCount: emailList.length,
          createdAt: new Date(),
          source: 'auto-alert'
        });
      }
    }

    lastAutoAlertRun = {
      ranAt: new Date().toISOString(),
      success: true,
      disastersChecked: disasters.length,
      alertsSent,
      skippedExisting,
      skippedNoRecipients,
      error: null
    };
  } catch (error) {
    console.error('Auto-alert worker error:', error);
    lastAutoAlertRun = {
      ranAt: new Date().toISOString(),
      success: false,
      disastersChecked: 0,
      alertsSent: 0,
      skippedExisting: 0,
      skippedNoRecipients: 0,
      error: error?.message || 'Unknown auto-alert error'
    };
  }
}

function startAutoAlertWorker() {
  if (!ENABLE_AUTO_ALERTS) {
    console.log('Auto-alert worker disabled. Set ENABLE_AUTO_ALERTS=true to enable.');
    return;
  }

  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASS) {
    console.log('Auto-alert worker disabled. Missing NODEMAILER_EMAIL or NODEMAILER_PASS.');
    return;
  }

  console.log(`Auto-alert worker started. Interval: ${ALERT_POLL_INTERVAL_MS}ms`);

  sendAutoAlertsForCurrentDisasters();

  setInterval(() => {
    sendAutoAlertsForCurrentDisasters();
  }, ALERT_POLL_INTERVAL_MS);
}

app.post('/api/admin/auto-alerts/run', async (req, res) => {
  try {
    await sendAutoAlertsForCurrentDisasters();
    res.status(200).json({ message: 'Auto-alert worker run completed.' });
  } catch (error) {
    console.error('Manual auto-alert run failed:', error);
    res.status(500).json({ message: 'Failed to run auto-alert worker.' });
  }
});

app.get('/api/admin/auto-alerts/status', async (req, res) => {
  try {
    const configured = Boolean(process.env.NODEMAILER_EMAIL && process.env.NODEMAILER_PASS);
    res.status(200).json({
      autoAlertsEnabled: ENABLE_AUTO_ALERTS,
      pollIntervalMs: ALERT_POLL_INTERVAL_MS,
      nodemailerConfigured: configured,
      nodemailerSender: process.env.NODEMAILER_EMAIL || null,
      lastAutoAlertRun
    });
  } catch (error) {
    console.error('Auto-alert status failed:', error);
    res.status(500).json({ message: 'Failed to get auto-alert status.' });
  }
});

app.post('/api/admin/email/test', async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to) {
      return res.status(400).json({ message: 'Missing test recipient email in request body.' });
    }
    if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASS) {
      return res.status(400).json({ message: 'NODEMAILER credentials are not configured.' });
    }

    await transporter.sendMail({
      from: `"SHIELD Test" <${process.env.NODEMAILER_EMAIL}>`,
      to,
      subject: 'SHIELD test email',
      text: `If you received this email, SMTP is working. Sent at ${new Date().toISOString()}`
    });

    res.status(200).json({ message: `Test email sent to ${to}` });
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({ message: error?.message || 'Failed to send test email.' });
  }
});

app.get('/api/admin/auto-alerts/diagnose', async (req, res) => {
  try {
    const disasters = await fetchLiveDisastersData();
    const users = await getUsersCollection();
    const sample = disasters.slice(0, 10);

    const report = [];
    for (const disaster of sample) {
      const provinces = extractMatchedProvinces(disaster);
      const recipientBreakdown = [];

      for (const province of provinces) {
        const provinceRegex = buildProvinceRegex(province);
        const count = await users.countDocuments({
          accountStatus: 'Active',
          'location.province': { $regex: provinceRegex }
        });
        recipientBreakdown.push({ province, count });
      }

      report.push({
        disasterId: disaster.id,
        title: disaster.title,
        city: disaster.city,
        matchedProvinces: provinces,
        recipientBreakdown
      });
    }

    res.status(200).json({
      checkedAt: new Date().toISOString(),
      totalDisasters: disasters.length,
      sampleSize: sample.length,
      report
    });
  } catch (error) {
    console.error('Auto-alert diagnose failed:', error);
    res.status(500).json({ message: 'Failed to diagnose auto-alert matching.' });
  }
});
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`SHIELD Backend Server running on port ${PORT}`);
  startAutoAlertWorker();
});