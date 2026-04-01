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

const ALERT_POLL_INTERVAL_MS = Number(process.env.ALERT_POLL_INTERVAL_MS || 5 * 60 * 1000);
const ENABLE_AUTO_ALERTS = String(process.env.ENABLE_AUTO_ALERTS || 'false').toLowerCase() === 'true';

const PROVINCE_KEYWORDS = {
  'Bulacan': ['bulacan', 'malolos', 'meycauayan', 'san jose del monte', 'marilao'],
  'Albay': ['albay', 'legazpi', 'tabaco', 'ligao', 'daraga'],
  'Camarines Sur': ['camarines sur', 'naga', 'iriga', 'cam sur'],
  'Sorsogon': ['sorsogon', 'sorsogon city'],
  'Batangas': ['batangas', 'lipa', 'tanauan', 'nasugbu'],
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

async function fetchLiveDisastersData() {
  const usgsUrl = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=4.5&maxlatitude=21.5&minlongitude=116.9&maxlongitude=126.6&minmagnitude=5.0&orderby=time&limit=10';
  const nasaUrl = 'https://eonet.gsfc.nasa.gov/api/v3/events?bbox=116.9,4.5,126.6,21.5&status=open';

  const [usgsResponse, nasaResponse] = await Promise.all([
    fetch(usgsUrl),
    fetch(nasaUrl)
  ]);

  if (!usgsResponse.ok || !nasaResponse.ok) {
    throw new Error(`Disaster providers unavailable. USGS=${usgsResponse.status} NASA=${nasaResponse.status}`);
  }

  const usgsData = await usgsResponse.json();
  const nasaData = await nasaResponse.json();

  const allDisasters = [];
  if (usgsData.features) {
    usgsData.features.forEach(quake => {
      const mag = quake.properties.mag;
      const severityLevel = mag >= 6.0 ? 'High' : 'Medium';
      const dateObj = new Date(quake.properties.time);

      allDisasters.push({
        id: quake.id,
        type: 'Earthquake',
        title: `Magnitude ${mag}`,
        severity: severityLevel,
        city: quake.properties.place,
        lat: quake.geometry.coordinates[1],
        lng: quake.geometry.coordinates[0],
        source: 'USGS',
        updatedAt: dateObj.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
        status: 'Active'
      });
    });
  }

  if (nasaData.events) {
    nasaData.events.forEach(event => {
      const latestGeo = event.geometry[event.geometry.length - 1];

      let eventType = 'General Disaster';
      const categoryId = event.categories[0].id;

      if (categoryId === 'severeStorms') eventType = 'Typhoon';
      else if (categoryId === 'volcanoes') eventType = 'Volcanic Activity';
      else if (categoryId === 'wildfires') eventType = 'Fire';
      else if (categoryId === 'floods') eventType = 'Flood';
      else if (categoryId === 'landslides') eventType = 'Landslide';

      const dateObj = new Date(latestGeo.date);

      allDisasters.push({
        id: event.id,
        type: eventType,
        title: event.title,
        severity: 'High',
        city: 'Philippines Area',
        lat: latestGeo.coordinates[1],
        lng: latestGeo.coordinates[0],
        source: 'NASA EONET',
        updatedAt: dateObj.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
        status: 'Active'
      });
    });
  }

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
    return;
  }

  try {
    const disasters = await fetchLiveDisastersData();
    if (!Array.isArray(disasters) || disasters.length === 0) {
      return;
    }

    const users = await getUsersCollection();
    const alertLogs = await getAlertLogsCollection();

    for (const disaster of disasters) {
      const provinces = extractMatchedProvinces(disaster);
      if (provinces.length === 0) continue;

      for (const province of provinces) {
        const alreadySent = await alertLogs.findOne({
          disasterId: disaster.id,
          province
        });
        if (alreadySent) continue;

        const escapedProvince = escapeRegex(province);
        const recipients = await users.find({
          accountStatus: 'Active',
          'location.province': { $regex: `^${escapedProvince}$`, $options: 'i' }
        }).toArray();

        if (recipients.length === 0) {
          await alertLogs.insertOne({
            disasterId: disaster.id,
            province,
            recipientsCount: 0,
            createdAt: new Date(),
            source: 'auto-no-recipients'
          });
          continue;
        }

        const emailList = recipients.map((user) => user.email).filter(Boolean);
        if (emailList.length === 0) continue;

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

        await alertLogs.insertOne({
          disasterId: disaster.id,
          province,
          recipientsCount: emailList.length,
          createdAt: new Date(),
          source: 'auto-alert'
        });
      }
    }
  } catch (error) {
    console.error('Auto-alert worker error:', error);
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
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ SHIELD Backend Server running on port ${PORT}`);
  startAutoAlertWorker();
});