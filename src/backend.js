import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';


dotenv.config();
const app = express();
app.use(cors()); 
app.use(express.json()); 

const client = new MongoClient(process.env.MONGO_URI);

// POST METHOD, INSERTS DATA TO DATABAS, SIR NEIL TINANGGAL KO NA MGA EMOJI BAKA SABIHIN MO AI NANAMAN HAYSSS:<
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, province, city } = req.body;

    await client.connect();
    const db = client.db('shield_db');
    const usersCollection = db.collection('users');

    const result = await usersCollection.insertOne({
      name: name,
      email: email,
      password: password, 
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
    res.status(500).json({ message: "Something went wrong saving the user." });
  }
});

//GET method, GETS DATAS FROM DATABASE
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    await client.connect();
    const db = client.db('shield_db');
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "Account not found. Please register first." });
    }

    if (user.password !== password) {
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


app.listen(5000, () => {
  console.log('✅ SHIELD Backend Server running on http://localhost:5000');
});