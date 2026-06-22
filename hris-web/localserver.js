import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.resolve('localserver_db.json');

// In-memory store fallback
let serverState = {
  hris_employees: [],
  hris_user_passwords: {},
  hris_custom_usernames: {},
  hris_user_roles: {},
  hris_training_materials: [],
  hris_broadcasts: [],
  hris_disc_results: [],
  hris_360_ratings: [],
  hris_notifications: [],
  credentials: []
};

const hrisDatabase = serverState;

// Load existing DB if present
if (fs.existsSync(DB_FILE)) {
  try {
    serverState = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    console.log('Loaded serverState from localserver_db.json');
  } catch (err) {
    console.error('Error reading localserver_db.json, using defaults:', err.message);
  }
}
serverState.credentials = serverState.credentials || [];

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(serverState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving localserver_db.json:', err.message);
  }
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder']
}));
app.use(express.json({ limit: '50mb' }));

// 1. Health check
app.get('/api/sync-health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), port: PORT });
});

// 2. Gateway Sync endpoint for Web App
app.post('/api/sync', (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Invalid sync data format' });
  }

  // Merge keys from web
  Object.keys(data).forEach(key => {
    if (key in serverState) {
      serverState[key] = data[key];
    } else {
      serverState[key] = data[key]; // Add dynamic keys if needed
    }
  });

  saveDb();
  res.json({ status: 'success', serverState });
});

app.get('/api/sync', (req, res) => {
  res.json({ status: 'success', serverState });
});

// Endpoint menerima akun baru dari Web Admin
app.post('/api/credentials/sync', (req, res) => {
  const { username, password, employeeName, outlet, role, id, employeeId } = req.body;
  const accountExists = hrisDatabase.credentials.some(user => user.username === username);
  if (!accountExists) {
    hrisDatabase.credentials.push({ username, password, employeeName, outlet, role, id: Number(id), employeeId: Number(employeeId) });
  } else {
    const idx = hrisDatabase.credentials.findIndex(user => user.username === username);
    hrisDatabase.credentials[idx] = { username, password, employeeName, outlet, role, id: Number(id), employeeId: Number(employeeId) };
  }
  saveDb();
  res.status(200).json({ success: true, message: "Kredensial Sinkron ke Server Pusat" });
});

// Endpoint validasi login untuk Mobile APK
app.post('/api/mobile/login', (req, res) => {
  const { username, password } = req.body;
  const user = hrisDatabase.credentials.find(u => u.username === username && u.password === password);
  if (user) {
    res.status(200).json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: "Username atau Password Salah" });
  }
});

// 3. Credentials endpoint for Mobile App
app.get('/api/credentials', (req, res) => {
  res.json({
    status: 'success',
    employees: serverState.hris_employees || [],
    passwords: serverState.hris_user_passwords || {},
    usernames: serverState.hris_custom_usernames || {},
    roles: serverState.hris_user_roles || {}
  });
});

// 4. KPI endpoint (Get my 360-ratings or submit rating)
app.get('/api/kpi', (req, res) => {
  res.json({
    status: 'success',
    ratings: serverState.hris_360_ratings || []
  });
});

app.post('/api/kpis/360-ratings', (req, res) => {
  const rating = req.body;
  if (!rating || typeof rating !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Invalid rating format' });
  }
  rating.id = `RATING-${Date.now()}`;
  rating.created_at = new Date().toISOString();
  
  if (!serverState.hris_360_ratings) serverState.hris_360_ratings = [];
  serverState.hris_360_ratings.push(rating);
  saveDb();

  res.json({ status: 'success', data: rating });
});

// 5. Broadcasts endpoint
app.get('/api/broadcasts', (req, res) => {
  res.json({
    status: 'success',
    broadcasts: serverState.hris_broadcasts || [],
    notifications: serverState.hris_notifications || []
  });
});

// 6. DISC Results endpoints
app.get('/api/disc-results', (req, res) => {
  res.json({
    status: 'success',
    results: serverState.hris_disc_results || []
  });
});

app.post('/api/disc-results', (req, res) => {
  const discResult = req.body;
  if (!discResult || typeof discResult !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Invalid DISC result format' });
  }
  discResult.id = `DISC-${Date.now()}`;
  discResult.created_at = new Date().toISOString();

  if (!serverState.hris_disc_results) serverState.hris_disc_results = [];
  serverState.hris_disc_results.push(discResult);
  saveDb();

  res.json({ status: 'success', data: discResult });
});

// 7. Training Media endpoint
app.get('/api/training-media', (req, res) => {
  res.json({
    status: 'success',
    materials: serverState.hris_training_materials || []
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`HRIS Sync Gateway running at http://localhost:${PORT}`);
  console.log(`Open for local network / mobile access`);
  console.log(`====================================================`);
});
