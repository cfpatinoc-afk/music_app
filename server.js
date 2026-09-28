const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const ROTATION_FILE = path.join(DATA_DIR, 'albums-rotation.json');
const RATINGS_FILE = path.join(DATA_DIR, 'albums-rating.json');
const VINYL_FILE = path.join(DATA_DIR, 'vinyl-list.json');
const GOALS_FILE = path.join(DATA_DIR, 'daily-goals.json');

// API Routes

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
app.put('/api/rotation', async (req, res) => {
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
app.put('/api/ratings', async (req, res) => {
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
app.put('/api/vinyl', async (req, res) => {
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
app.put('/api/goals', async (req, res) => {
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