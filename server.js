require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes')
const userRoutes = require('./routes/userRoutes')
const taskRoutes = require('./routes/taskRoutes')
const reportRoutes = require('./routes/reportRoutes')
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User');
const crypto = require('crypto');

const app = express();

// Middleware to handle CORS
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000', // Alternative dev port
  process.env.CLIENT_URL, // Your Vercel frontend URL
].filter(Boolean); // Remove any undefined values

app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Allow cookies/credentials
}));

//Connect Database
connectDB();


//Middleware
app.use(express.json());
app.use(passport.initialize());

// Passport Google OAuth setup
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Find or create user
      let user = await User.findOne({ email: profile.emails[0].value });
      if (!user) {
        user = await User.create({
          name: profile.displayName,
          email: profile.emails[0].value,
          password: crypto.randomBytes(32).toString('hex'), // random password for Google users
          profileImageUrl: profile.photos[0]?.value || '',
          role: 'member',
          organizationCode: '00000000000000', // Always default for new Google users
        });
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

//Routes
app.use('/api/auth/' , authRoutes)
app.use('/api/users/' , userRoutes)
app.use('/api/tasks/' , taskRoutes)
app.use('/api/reports/' , reportRoutes)

app.get('/api/org-code', (req, res) => {
  res.json({ orgCode: process.env.ORG_CODE || null });
});

//Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})
