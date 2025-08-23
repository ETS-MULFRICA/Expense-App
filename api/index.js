import express from 'express';
import session from 'express-session';
import { createMemoryStore } from './storage.js';
import { setupAuth } from './auth.js';

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration for Vercel
const MemoryStore = createMemoryStore(session);
app.use(session({
  store: new MemoryStore({ checkPeriod: 86400000 }),
  secret: process.env.SESSION_SECRET || 'fallback-secret-for-dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Setup authentication
setupAuth(app);

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Vercel API is working!', timestamp: new Date().toISOString() });
});

// Basic auth endpoints
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name, email } = req.body;
    
    if (!username || !password || !name || !email) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // For now, just return success (we'll implement full registration later)
    res.status(201).json({ 
      message: 'Registration successful', 
      user: { username, name, email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/login', (req, res) => {
  // Handle login - for now just return success
  res.json({ message: 'Login endpoint working' });
});

// Export for Vercel
export default app;
