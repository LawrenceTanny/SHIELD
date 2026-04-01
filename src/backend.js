import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();
const app = express();
app.use(cors()); 
app.use(express.json()); 

const client = new MongoClient(process.env.MONGO_URI);

let usersCollection;

async function getUsersCollection() {
  if (usersCollection) return usersCollection;
  await client.connect();
  const db = client.db('shield_db');
  usersCollection = db.collection('users');
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  return usersCollection;
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
    const usgsUrl = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=4.5&maxlatitude=21.5&minlongitude=116.9&maxlongitude=126.6&minmagnitude=5.0&orderby=time&limit=10';
    const nasaUrl = 'https://eonet.gsfc.nasa.gov/api/v3/events?bbox=116.9,4.5,126.6,21.5&status=open';

    const [usgsResponse, nasaResponse] = await Promise.all([
      fetch(usgsUrl),
      fetch(nasaUrl)
    ]);

    const usgsData = await usgsResponse.json();
    const nasaData = await nasaResponse.json();

    const allDisasters = [];
    if (usgsData.features) {
      usgsData.features.forEach(quake => {
        const mag = quake.properties.mag;
        let severityLevel = mag >= 6.0 ? "High" : "Medium";
        const dateObj = new Date(quake.properties.time);

        allDisasters.push({
          id: quake.id,
          type: "Earthquake",
          title: `Magnitude ${mag}`,
          severity: severityLevel,
          city: quake.properties.place,
          lat: quake.geometry.coordinates[1], 
          lng: quake.geometry.coordinates[0], 
          source: "USGS",
          updatedAt: dateObj.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
          status: "Active"
        });
      });
    }

    if (nasaData.events) {
      nasaData.events.forEach(event => {
        const latestGeo = event.geometry[event.geometry.length - 1];

        let eventType = "General Disaster";
        const categoryId = event.categories[0].id;
        
        if (categoryId === "severeStorms") eventType = "Typhoon";
        else if (categoryId === "volcanoes") eventType = "Volcanic Activity";
        else if (categoryId === "wildfires") eventType = "Fire";
        else if (categoryId === "floods") eventType = "Flood";
        else if (categoryId === "landslides") eventType = "Landslide";

        const dateObj = new Date(latestGeo.date);

        allDisasters.push({
          id: event.id,
          type: eventType,
          title: event.title,
          severity: "High", 
          city: "Philippines Area", 
          lat: latestGeo.coordinates[1], 
          lng: latestGeo.coordinates[0], 
          source: "NASA EONET",
          updatedAt: dateObj.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
          status: "Active"
        });
      });
    }

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

// API PARA SA PHILIPHINE WEATHER, SA FRONT END KO NA AAYUSIN NA BASE SA CITY NG USER.
app.get('/api/weather', async (req, res) => {
  try {
    const response = await fetch('https://www.panahon.gov.ph/api/v1/aws');
    const data = await response.json();

    res.status(200).json(data);

  } catch (error) {
    console.error("Error fetching weather:", error);
    res.status(500).json({ message: "Failed to fetch local weather." });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ SHIELD Backend Server running on port ${PORT}`);
});