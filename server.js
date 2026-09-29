const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 8080;

// JWT Secret (en producción usar variable de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'music-app-secret-key-change-in-production';

// Admin credentials (en producción usar base de datos)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const ROTATION_FILE = path.join(DATA_DIR, 'albums-rotation.json');
const RATINGS_FILE = path.join(DATA_DIR, 'albums-rating.json');
const VINYL_FILE = path.join(DATA_DIR, 'vinyl-list.json');
const GOALS_FILE = path.join(DATA_DIR, 'daily-goals.json');

// API Routes

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Verify token endpoint
app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, username: req.user.username });
});

// Get rotation data
app.get('/api/rotation', async (req, res) => {
    try {
        const data = await fs.readFile(ROTATION_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading rotation file:', error);
        res.status(500).json({ error: 'Error reading rotation data' });
    }
});

// Update rotation data
app.put('/api/rotation', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        console.log('📥 Recibiendo datos de rotation:', data.length, 'álbumes');
        await fs.writeFile(ROTATION_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log('✅ Rotation data guardado en archivo');
        res.json({ success: true, message: 'Rotation data updated successfully' });
    } catch (error) {
        console.error('❌ Error writing rotation file:', error);
        res.status(500).json({ error: 'Error writing rotation data' });
    }
});

// Get ratings data
app.get('/api/ratings', async (req, res) => {
    try {
        const data = await fs.readFile(RATINGS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading ratings file:', error);
        res.status(500).json({ error: 'Error reading ratings data' });
    }
});

// Update ratings data
app.put('/api/ratings', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        await fs.writeFile(RATINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
        res.json({ success: true, message: 'Ratings data updated successfully' });
    } catch (error) {
        console.error('Error writing ratings file:', error);
        res.status(500).json({ error: 'Error writing ratings data' });
    }
});

// Get vinyl data
app.get('/api/vinyl', async (req, res) => {
    try {
        const data = await fs.readFile(VINYL_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading vinyl file:', error);
        res.status(500).json({ error: 'Error reading vinyl data' });
    }
});

// Update vinyl data
app.put('/api/vinyl', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        await fs.writeFile(VINYL_FILE, JSON.stringify(data, null, 2), 'utf8');
        res.json({ success: true, message: 'Vinyl data updated successfully' });
    } catch (error) {
        console.error('Error writing vinyl file:', error);
        res.status(500).json({ error: 'Error writing vinyl data' });
    }
});

// Get goals data
app.get('/api/goals', async (req, res) => {
    try {
        const data = await fs.readFile(GOALS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading goals file:', error);
        res.status(500).json({ error: 'Error reading goals data' });
    }
});

// Update goals data
app.put('/api/goals', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        await fs.writeFile(GOALS_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log('✅ Goals data guardado en archivo');
        res.json({ success: true, message: 'Goals data updated successfully' });
    } catch (error) {
        console.error('Error writing goals file:', error);
        res.status(500).json({ error: 'Error writing goals data' });
    }
});

// Download data files
app.get('/api/download/rotation', async (req, res) => {
    try {
        const data = await fs.readFile(ROTATION_FILE, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=albums-rotation.json');
        res.send(data);
    } catch (error) {
        console.error('Error reading rotation file:', error);
        res.status(500).json({ error: 'Error reading rotation data' });
    }
});

app.get('/api/download/ratings', async (req, res) => {
    try {
        const data = await fs.readFile(RATINGS_FILE, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=albums-rating.json');
        res.send(data);
    } catch (error) {
        console.error('Error reading ratings file:', error);
        res.status(500).json({ error: 'Error reading ratings data' });
    }
});

app.get('/api/download/vinyl', async (req, res) => {
    try {
        const data = await fs.readFile(VINYL_FILE, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=vinyl-list.json');
        res.send(data);
    } catch (error) {
        console.error('Error reading vinyl file:', error);
        res.status(500).json({ error: 'Error reading vinyl data' });
    }
});

app.get('/api/download/goals', async (req, res) => {
    try {
        const data = await fs.readFile(GOALS_FILE, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=daily-goals.json');
        res.send(data);
    } catch (error) {
        console.error('Error reading goals file:', error);
        res.status(500).json({ error: 'Error reading goals data' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🎵 Music App server running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🔌 API endpoints available:`);
    console.log(`   GET/PUT  /api/rotation`);
    console.log(`   GET/PUT  /api/ratings`);
    console.log(`   GET/PUT  /api/vinyl`);
    console.log(`   GET/PUT  /api/goals`);
});