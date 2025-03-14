const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;
const host = "https://jamiegame.onrender.com"
// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/saveDungeon', (req, res) => {
    const dungeonData = req.body;
    fs.writeFile('dungeon.json', JSON.stringify(dungeonData), (err) => {
        if (err) {
            console.error('Error saving dungeon:', err);
            res.status(500).json({ error: 'Failed to save dungeon' });
        } else {
            res.json({ message: 'Dungeon saved successfully' });
        }
    });
});


app.get('/tileset-info', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'terrain.png');
    fs.stat(filePath, (err, stats) => {
        if (err) {
            res.status(500).json({ error: 'Failed to get tileset info' });
        } else {
            res.json({ lastModified: stats.mtimeMs });
        }
    });
});

app.get('/loadDungeon', (req, res) => {
    fs.readFile('dungeon.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error loading dungeon:', err);
            res.status(500).json({ error: 'Failed to load dungeon' });
        } else {
            res.json(JSON.parse(data));
        }
    });
});

// Start the server
app.listen(port,host , () => {
    console.log(`Server running at http://${host}:${port}`);
});
