import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import session from 'express-session';
import MongoStore from 'connect-mongo';

dotenv.config();
const app = express();

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const CLIENT_ORIGINS = process.env.CLIENT_ORIGINS || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_COOKIE_SAMESITE = process.env.SESSION_COOKIE_SAMESITE || (IS_PRODUCTION ? 'none' : 'lax');
const SESSION_COOKIE_SECURE = String(process.env.SESSION_COOKIE_SECURE || (IS_PRODUCTION ? 'true' : 'false')) === 'true';

const allowedOrigins = new Set(
  [
    CLIENT_ORIGIN,
    ...CLIENT_ORIGINS.split(',').map((item) => item.trim()).filter(Boolean),
    'http://localhost:5173',
    'https://shield.lawrencetan1104.workers.dev'
  ].filter(Boolean)
);

app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
})); 
app.use(express.json()); 

app.use(session({
  name: 'shield.sid',
  secret: process.env.SESSION_SECRET || 'dev-insecure-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName: 'shield_db',
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 7
  }),
  cookie: {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: SESSION_COOKIE_SAMESITE,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

const client = new MongoClient(process.env.MONGO_URI);

let usersCollection;
let dbInstance;
let alertLogsCollection;
let disasterCacheCollection;
let reverseGeocodeCollection;
let newsCacheCollection;

let cachedDisastersPayload = null;
let cachedDisastersFetchedAt = 0;
const disasterCacheTtlMs = Number(process.env.DISASTER_CACHE_TTL_MS || 10 * 60 * 1000);

const reverseGeocodeMemoryCache = new Map();
const reverseGeocodeMinDelayMs = Number(process.env.REVERSE_GEOCODE_MIN_DELAY_MS || 5000);
let reverseGeocodeQueue = Promise.resolve();
let lastReverseGeocodeAt = 0;

const DISASTER_REFRESH_INTERVAL_MS = Number(process.env.DISASTER_REFRESH_INTERVAL_MS || 60 * 1000);
const ALERT_POLL_INTERVAL_MS = Number(process.env.ALERT_POLL_INTERVAL_MS || 5 * 60 * 1000);
const ENABLE_AUTO_ALERTS = String(process.env.ENABLE_AUTO_ALERTS || 'false').toLowerCase() === 'true';

let disasterRefreshInFlight = null;
let lastDisasterRefreshRun = {
  ranAt: null,
  success: false,
  fetchedCount: 0,
  updatedCache: false,
  source: null,
  error: null
};

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

function keywordMatchesText(sourceText, keyword) {
  const normalizedKeyword = String(keyword).trim().replace(/\s+/g, '\\s+');
  const pattern = new RegExp(`(^|[^a-z0-9])${normalizedKeyword}([^a-z0-9]|$)`, 'i');
  return pattern.test(sourceText);
}

function extractMatchedProvinces(disaster) {
  const sourceText = `${disaster?.city || ''} ${disaster?.title || ''}`.toLowerCase();
  const matched = [];

  for (const [province, keywords] of Object.entries(PROVINCE_KEYWORDS)) {
    if (keywords.some((kw) => keywordMatchesText(sourceText, kw))) {
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
  // Migrate old province-level dedupe index to user-level dedupe index.
  try {
    await alertLogsCollection.dropIndex('disasterId_1_province_1');
  } catch (error) {
    if (error?.codeName !== 'IndexNotFound') {
      throw error;
    }
  }
  await alertLogsCollection.createIndex({ disasterId: 1, userId: 1, source: 1 }, { unique: true });
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

async function getNewsCacheCollection() {
  if (newsCacheCollection) return newsCacheCollection;
  const db = await getDatabase();
  newsCacheCollection = db.collection('news_cache');
  await newsCacheCollection.createIndex({ cacheDate: -1 });
  await newsCacheCollection.createIndex({ lastAttemptDate: -1 });
  return newsCacheCollection;
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

function getDisasterCacheSignature(disaster) {
  return JSON.stringify({
    id: disaster?.id || null,
    type: disaster?.type || null,
    title: disaster?.title || null,
    severity: disaster?.severity || null,
    city: disaster?.city || null,
    province: disaster?.province || null,
    lat: Number(disaster?.lat) || null,
    lng: Number(disaster?.lng) || null,
    source: disaster?.source || null,
    status: disaster?.status || null
  });
}

function areDisasterSnapshotsEqual(currentDisasters, nextDisasters) {
  if (!Array.isArray(currentDisasters) || !Array.isArray(nextDisasters)) return false;
  if (currentDisasters.length !== nextDisasters.length) return false;

  const currentSignatures = currentDisasters.map(getDisasterCacheSignature).sort();
  const nextSignatures = nextDisasters.map(getDisasterCacheSignature).sort();

  return currentSignatures.every((signature, index) => signature === nextSignatures[index]);
}

function mergeDisastersById(primaryDisasters, fallbackDisasters) {
  const merged = new Map();

  for (const disaster of fallbackDisasters || []) {
    if (!disaster?.id) continue;
    merged.set(disaster.id, disaster);
  }

  for (const disaster of primaryDisasters || []) {
    if (!disaster?.id) continue;
    merged.set(disaster.id, disaster);
  }

  return Array.from(merged.values());
}

function isSourceMatch(disaster, source) {
  return String(disaster?.source || '').toLowerCase() === String(source || '').toLowerCase();
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

async function fetchDisastersFromProviders() {
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

  const usgsSucceeded = usgsResult.status === 'fulfilled';
  const nasaSucceeded = nasaResult.status === 'fulfilled';

  const usgsData = usgsResult.status === 'fulfilled' ? usgsResult.value : null;
  const nasaData = nasaResult.status === 'fulfilled' ? nasaResult.value : null;

  const allDisasters = [];
  if (usgsData?.features) {
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

  if (nasaData?.events) {
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

  return {
    disasters: allDisasters,
    usgsSucceeded,
    nasaSucceeded
  };
}

async function fetchLiveDisastersData() {
  const cachedDisasters = await getCachedDisastersPayload();
  if (cachedDisasters) {
    return cachedDisasters;
  }

  const { disasters: liveDisasters } = await fetchDisastersFromProviders();
  if (Array.isArray(liveDisasters) && liveDisasters.length > 0) {
    await setCachedDisastersPayload(liveDisasters);
  }

  return liveDisasters;
}

async function refreshDisasterCacheFromProviders() {
  if (disasterRefreshInFlight) {
    return disasterRefreshInFlight;
  }

  disasterRefreshInFlight = (async () => {
    try {
      const {
        disasters: liveDisasters,
        usgsSucceeded,
        nasaSucceeded
      } = await fetchDisastersFromProviders();

      const cachedDisasters = await getCachedDisastersPayload();

      const preserveSources = [];
      if (!usgsSucceeded) preserveSources.push('USGS');
      if (!nasaSucceeded) preserveSources.push('NASA EONET');

      const preservedDisasters = (cachedDisasters || []).filter((disaster) =>
        preserveSources.some((source) => isSourceMatch(disaster, source))
      );

      const mergedDisasters = mergeDisastersById(liveDisasters, preservedDisasters);

      if (!Array.isArray(mergedDisasters) || mergedDisasters.length === 0) {
        lastDisasterRefreshRun = {
          ranAt: new Date().toISOString(),
          success: false,
          fetchedCount: 0,
          updatedCache: false,
          source: 'live',
          error: 'No live disasters returned from providers.'
        };
        return lastDisasterRefreshRun;
      }

      const cacheChanged = !cachedDisasters || !areDisasterSnapshotsEqual(cachedDisasters, mergedDisasters);

      if (cacheChanged) {
        await setCachedDisastersPayload(mergedDisasters);
      }

      lastDisasterRefreshRun = {
        ranAt: new Date().toISOString(),
        success: true,
        fetchedCount: mergedDisasters.length,
        updatedCache: cacheChanged,
        source: usgsSucceeded && nasaSucceeded
          ? 'live-all'
          : usgsSucceeded
            ? 'live-usgs+cached-nasa'
            : nasaSucceeded
              ? 'live-nasa+cached-usgs'
              : 'cached-only',
        error: null
      };

      return lastDisasterRefreshRun;
    } catch (error) {
      console.error('Disaster refresh worker error:', error);
      lastDisasterRefreshRun = {
        ranAt: new Date().toISOString(),
        success: false,
        fetchedCount: 0,
        updatedCache: false,
        source: 'live',
        error: error?.message || 'Unknown disaster refresh error'
      };
      return lastDisasterRefreshRun;
    } finally {
      disasterRefreshInFlight = null;
    }
  })();

  return disasterRefreshInFlight;
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
      preferences: {
        receiveDisasterAlerts: true,
        subscribeNewsletter: false
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

function toPublicUser(userDoc) {
  return {
    id: userDoc?._id ? String(userDoc._id) : null,
    name: userDoc?.name || '',
    email: userDoc?.email || '',
    province: userDoc?.location?.province || '',
    city: userDoc?.location?.city || '',
    accountStatus: userDoc?.accountStatus || 'Active',
    preferences: {
      receiveDisasterAlerts: userDoc?.preferences?.receiveDisasterAlerts !== false,
      subscribeNewsletter: userDoc?.preferences?.subscribeNewsletter === true
    }
  };
}

async function getAuthenticatedUser(req) {
  const userId = req?.session?.userId;
  if (!userId) return null;

  if (!ObjectId.isValid(userId)) return null;

  const usersCollection = await getUsersCollection();
  return usersCollection.findOne({ _id: new ObjectId(userId) });
}

async function requireAuth(req, res, next) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    req.authUser = user;
    return next();
  } catch (error) {
    console.error('Auth middleware failed:', error);
    return res.status(500).json({ message: 'Authentication check failed.' });
  }
}

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

    req.session.userId = String(user._id);

    res.status(200).json({ 
      message: "Login successful!", 
      user: toPublicUser(user)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during login." });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Logout failed:', error);
      return res.status(500).json({ message: 'Failed to log out.' });
    }
    res.clearCookie('shield.sid');
    return res.status(200).json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return res.status(200).json({ user: toPublicUser(req.authUser) });
});

app.get('/api/account', requireAuth, async (req, res) => {
  try {
    return res.status(200).json({
      user: toPublicUser(req.authUser)
    });
  } catch (error) {
    console.error('Error fetching account profile:', error);
    return res.status(500).json({ message: 'Failed to fetch account profile.' });
  }
});

app.patch('/api/account', requireAuth, async (req, res) => {
  try {
    const { name, preferences } = req.body || {};

    const updates = {};
    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    if (preferences && typeof preferences === 'object') {
      if (typeof preferences.receiveDisasterAlerts === 'boolean') {
        updates['preferences.receiveDisasterAlerts'] = preferences.receiveDisasterAlerts;
      }
      if (typeof preferences.subscribeNewsletter === 'boolean') {
        updates['preferences.subscribeNewsletter'] = preferences.subscribeNewsletter;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update.' });
    }

    updates.updatedAt = new Date();

    const usersCollection = await getUsersCollection();
    const updateResult = await usersCollection.updateOne(
      { _id: req.authUser._id },
      { $set: updates }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = await usersCollection.findOne(
      { _id: req.authUser._id },
      {
        projection: {
          _id: 0,
          name: 1,
          email: 1,
          location: 1,
          preferences: 1,
          accountStatus: 1
        }
      }
    );

    return res.status(200).json({
      message: 'Account updated successfully.',
      user: toPublicUser(user)
    });
  } catch (error) {
    console.error('Error updating account profile:', error);
    return res.status(500).json({ message: 'Failed to update account profile.' });
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
let newsRefreshInFlight = null;
const GNEWS_MAX_PER_REQUEST = Math.min(10, Math.max(1, Number(process.env.GNEWS_MAX_PER_REQUEST || 10)));
const GNEWS_TARGET_RESULTS = Math.max(1, Number(process.env.GNEWS_TARGET_RESULTS || 25));
const GNEWS_MAX_PAGES = Math.max(1, Number(process.env.GNEWS_MAX_PAGES || 5));

function getManilaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

app.get('/api/news', async (req, res) => {
  try {
    const forceRefresh = req.query.force === 'true';
    const apiKey = process.env.GNEWS_API_KEY;
    const todayDateKey = getManilaDateKey();
    const collection = await getNewsCacheCollection();
    const cachedRecord = await collection.findOne({ _id: 'latest' });

    console.log('[NEWS API] Request received. forceRefresh:', forceRefresh, 'apiKey exists:', !!apiKey);

    if (Array.isArray(cachedRecord?.data) && cachedRecord.data.length > 0) {
      cachedNews = cachedRecord.data;
      lastNewsFetchTime = cachedRecord?.fetchedAt ? new Date(cachedRecord.fetchedAt).getTime() : 0;
    }

    if (!forceRefresh && cachedRecord?.cacheDate === todayDateKey && Array.isArray(cachedRecord?.data) && cachedRecord.data.length > 0) {
      console.log('[NEWS API] Returning cached data (today).');
      return res.status(200).json(cachedRecord.data);
    }

    if (!forceRefresh && cachedRecord?.lastAttemptDate === todayDateKey) {
      if (Array.isArray(cachedRecord?.data) && cachedRecord.data.length > 0) {
        console.log('[NEWS API] Returning cached data (already checked today).');
        return res.status(200).json(cachedRecord.data);
      }

      console.log('[NEWS API] Already attempted today with no results.');
      return res.status(503).json({
        message: 'News API already checked today and no cache was available. Try again tomorrow.',
        nextRefreshDate: todayDateKey
      });
    }

    if (!apiKey) {
      console.warn('[NEWS API] GNEWS_API_KEY missing from environment!');
      if (Array.isArray(cachedRecord?.data) && cachedRecord.data.length > 0) {
        console.warn('[NEWS API] Serving stale cached news (no API key).');
        return res.status(200).json(cachedRecord.data);
      }
      return res.status(500).json({ message: 'News API key missing. Set GNEWS_API_KEY environment variable.' });
    }

    if (!newsRefreshInFlight) {
      newsRefreshInFlight = (async () => {
        console.log('[NEWS API] Starting fresh fetch from GNews...');

        // A strict, Google-style search query targeting ONLY PH disasters
        const query = encodeURIComponent("Philippines AND (typhoon OR earthquake OR flood OR volcano OR PAGASA OR Phivolcs)");
        const allArticles = [];
        const maxCandidates = [GNEWS_MAX_PER_REQUEST, 10, 5].filter((value, index, arr) => arr.indexOf(value) === index);
        let firstSuccessPayload = null;
        let lastProviderError = null;

        for (const maxResults of maxCandidates) {
          allArticles.length = 0;
          let candidateSucceeded = true;

          for (let page = 1; page <= GNEWS_MAX_PAGES && allArticles.length < GNEWS_TARGET_RESULTS; page += 1) {
            const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&country=ph&max=${maxResults}&page=${page}&sortby=publishedAt&apikey=${apiKey}`;
            console.log('[NEWS API] GNews URL:', url.replace(apiKey, '***API_KEY***'));

            const response = await fetch(url);
            console.log('[NEWS API] GNews response status:', response.status, 'max=', maxResults, 'page=', page);

            const rawBody = await response.text();
            let parsedBody = null;
            try {
              parsedBody = rawBody ? JSON.parse(rawBody) : null;
            } catch (_error) {
              parsedBody = null;
            }

            if (!response.ok) {
              const providerMessage = parsedBody?.errors?.[0] || parsedBody?.message || parsedBody?.error || rawBody || `HTTP ${response.status}`;
              lastProviderError = `GNews request failed (${response.status}) max=${maxResults} page=${page}: ${providerMessage}`;
              console.warn('[NEWS API] GNews non-OK response:', lastProviderError);
              candidateSucceeded = false;
              break;
            }

            if (!firstSuccessPayload) {
              firstSuccessPayload = parsedBody;
            }

            const pageArticles = Array.isArray(parsedBody?.articles) ? parsedBody.articles : [];
            console.log('[NEWS API] Articles fetched:', pageArticles.length, 'on page', page);

            if (pageArticles.length === 0) {
              break;
            }

            allArticles.push(...pageArticles);

            if (pageArticles.length < maxResults) {
              break;
            }
          }

          if (candidateSucceeded && allArticles.length > 0) {
            break;
          }
        }

        if (!firstSuccessPayload && allArticles.length === 0) {
          throw new Error(lastProviderError || 'GNews request failed with unknown error.');
        }

        console.log('[NEWS API] GNews response data keys:', Object.keys(firstSuccessPayload || {}));

        if (firstSuccessPayload?.error) {
          throw new Error(firstSuccessPayload.error?.message || 'GNews returned an error payload');
        }

        if (allArticles.length === 0) {
          console.warn('[NEWS API] GNews returned 0 articles across all pages.');
        }

        const seenKeys = new Set();
        const mappedNews = allArticles
          .map((article, index) => {
            const published = article?.publishedAt ? new Date(article.publishedAt) : null;
            const publishedAtIso = published && !Number.isNaN(published.getTime()) ? published.toISOString() : null;
            const publishedAtLabel = publishedAtIso
              ? new Date(publishedAtIso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })
              : 'N/A';

            return {
              id: article?.url || `${article?.title || 'news'}-${index}`,
              title: article?.title || 'News Update',
              description: article?.description || 'No details available.',
              url: article?.url || '#',
              source: article?.source?.name || 'GNews',
              image: article?.image || null,
              publishedAt: publishedAtIso || publishedAtLabel,
              date: publishedAtLabel
            };
          })
          .filter((item) => item.title)
          .filter((item) => {
            const dedupeKey = item.url && item.url !== '#' ? item.url : `${item.title}|${item.publishedAt}`;
            if (seenKeys.has(dedupeKey)) {
              return false;
            }
            seenKeys.add(dedupeKey);
            return true;
          });

        console.log('[NEWS API] Mapped and deduplicated articles:', mappedNews.length);

        if (mappedNews.length > 0) {
          cachedNews = mappedNews;
          lastNewsFetchTime = Date.now();

          await collection.updateOne(
            { _id: 'latest' },
            {
              $set: {
                data: mappedNews,
                cacheDate: todayDateKey,
                lastAttemptDate: todayDateKey,
                fetchedAt: new Date(),
                updatedAt: new Date(),
                source: 'gnews',
                itemsCount: mappedNews.length,
                lastError: null
              }
            },
            { upsert: true }
          );
          console.log('[NEWS API] Cache updated successfully with', mappedNews.length, 'articles.');
          return;
        }

        console.warn('[NEWS API] No articles after mapping/deduplication.');
        await collection.updateOne(
          { _id: 'latest' },
          {
            $set: {
              lastAttemptDate: todayDateKey,
              updatedAt: new Date(),
              lastError: 'No news found from provider.'
            }
          },
          { upsert: true }
        );

        throw new Error('No news found from provider.');
      })().finally(() => {
        newsRefreshInFlight = null;
      });
    }

    await newsRefreshInFlight;

    const latestRecord = await collection.findOne({ _id: 'latest' });
    if (Array.isArray(latestRecord?.data) && latestRecord.data.length > 0) {
      console.log('[NEWS API] Returning', latestRecord.data.length, 'articles after fetch.');
      return res.status(200).json(latestRecord.data);
    }

    console.warn('[NEWS API] No data available after fetch attempt.');
    return res.status(404).json({ message: 'No news found from provider.' });
  } catch (error) {
    console.error('[NEWS API] Error fetching news:', error?.message || error);
    try {
      const collection = await getNewsCacheCollection();
      const cachedRecord = await collection.findOne({ _id: 'latest' });
      if (Array.isArray(cachedRecord?.data) && cachedRecord.data.length > 0) {
        console.log('[NEWS API] Returning fallback cached data after error.');
        return res.status(200).json(cachedRecord.data);
      }
    } catch (cacheReadError) {
      console.error('[NEWS API] News cache fallback read failed:', cacheReadError?.message || cacheReadError);
    }

    return res.status(500).json({ message: 'Failed to fetch news data.' });
  }
});

// Admin endpoint to view cache status
app.get('/api/admin/news/status', async (req, res) => {
  try {
    const collection = await getNewsCacheCollection();
    const cachedRecord = await collection.findOne({ _id: 'latest' });
    const todayDateKey = getManilaDateKey();

    res.status(200).json({
      apiKeyConfigured: !!process.env.GNEWS_API_KEY,
      todayDateKey,
      cacheExists: !!cachedRecord,
      cache: cachedRecord ? {
        cacheDate: cachedRecord.cacheDate,
        isTodayCache: cachedRecord.cacheDate === todayDateKey,
        lastAttemptDate: cachedRecord.lastAttemptDate,
        alreadyAttemptedToday: cachedRecord.lastAttemptDate === todayDateKey,
        fetchedAt: cachedRecord.fetchedAt,
        itemsCount: cachedRecord.itemsCount,
        source: cachedRecord.source,
        lastError: cachedRecord.lastError,
        dataLength: Array.isArray(cachedRecord.data) ? cachedRecord.data.length : 0
      } : null,
      newsRefreshInFlightActive: !!newsRefreshInFlight
    });
  } catch (error) {
    console.error('[NEWS ADMIN] Status check failed:', error);
    res.status(500).json({ message: 'Failed to get news cache status.' });
  }
});

// Admin endpoint to reset/clear cache and force fresh fetch
app.post('/api/admin/news/reset', async (req, res) => {
  try {
    const collection = await getNewsCacheCollection();
    await collection.deleteOne({ _id: 'latest' });
    cachedNews = null;
    lastNewsFetchTime = 0;
    
    console.log('[NEWS ADMIN] Cache cleared. Next fetch will be fresh.');
    res.status(200).json({ message: 'News cache cleared. Next /api/news call will fetch fresh data.' });
  } catch (error) {
    console.error('[NEWS ADMIN] Reset failed:', error);
    res.status(500).json({ message: 'Failed to reset news cache.' });
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
      coverage: 'philippines',
      cloudsLayerAvailable: Boolean(apiKey)
    });

  } catch (error) {
    console.error("Error fetching weather:", error);
    res.status(500).json({ message: "Failed to fetch local weather." });
  }
});

// Para sa map layer, dun sa clouds thingy haha
app.get('/api/weather/clouds-tile/:z/:x/:y.png', async (req, res) => {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ message: 'Cloud layer unavailable. Missing OPENWEATHERMAP_API_KEY.' });
    }

    const { z, x, y } = req.params;
    const tileUrl = `https://tile.openweathermap.org/map/clouds_new/${z}/${x}/${y}.png?appid=${apiKey}`;
    const response = await fetch(tileUrl);

    if (!response.ok) {
      return res.status(response.status).json({ message: 'Failed to fetch cloud tile from provider.' });
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const tileBuffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(tileBuffer);
  } catch (error) {
    console.error('Error fetching cloud tile:', error);
    return res.status(500).json({ message: 'Failed to fetch cloud tile.' });
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
      "location.province": targetProvince,
      accountStatus: 'Active',
      "preferences.receiveDisasterAlerts": { $ne: false }
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
        const provinceRegex = buildProvinceRegex(province);
        const recipients = await users.find({
          accountStatus: 'Active',
          'preferences.receiveDisasterAlerts': { $ne: false },
          'location.province': { $regex: provinceRegex }
        }).toArray();

        if (recipients.length === 0) {
          skippedNoRecipients += 1;
          continue;
        }

        const unsentRecipients = [];
        for (const recipient of recipients) {
          const alreadySentToUser = await alertLogs.findOne({
            disasterId: disaster.id,
            userId: recipient._id,
            source: 'auto-alert'
          });

          if (alreadySentToUser) {
            skippedExisting += 1;
            continue;
          }

          unsentRecipients.push(recipient);
        }

        const emailList = unsentRecipients.map((user) => user.email).filter(Boolean);
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
        alertsSent += 1;

        await alertLogs.insertMany(
          unsentRecipients.map((recipient) => ({
            disasterId: disaster.id,
            province,
            userId: recipient._id,
            email: recipient.email,
            createdAt: new Date(),
            source: 'auto-alert'
          }))
        );
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

function startDisasterRefreshWorker() {
  console.log(`Disaster refresh worker started. Interval: ${DISASTER_REFRESH_INTERVAL_MS}ms`);
  refreshDisasterCacheFromProviders();

  setInterval(() => {
    refreshDisasterCacheFromProviders();
  }, DISASTER_REFRESH_INTERVAL_MS);
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

app.get('/api/admin/disasters/refresh-status', async (req, res) => {
  try {
    res.status(200).json({
      refreshIntervalMs: DISASTER_REFRESH_INTERVAL_MS,
      cacheTtlMs: disasterCacheTtlMs,
      lastDisasterRefreshRun,
      cachedDisastersCount: Array.isArray(cachedDisastersPayload) ? cachedDisastersPayload.length : 0
    });
  } catch (error) {
    console.error('Disaster refresh status failed:', error);
    res.status(500).json({ message: 'Failed to get disaster refresh status.' });
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
  startDisasterRefreshWorker();
  startAutoAlertWorker();
});