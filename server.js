const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());

// Serve the LineFoundry website
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    app: 'LineFoundry',
    version: '6.1.0',
    engineMode: 'public-consensus'
  });
});

// Public consensus engine
app.get('/api/engine', (req, res) => {
  try {
    const { refresh } = require('./engine');
    res.json(refresh());
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
});

// Expert leaderboard
app.get('/api/experts', (req, res) => {
  try {
    const { buildExpertBoard } = require('./expert-engine');
    res.json(buildExpertBoard());
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
});

// Refresh status
app.get('/api/refresh-status', (req, res) => {
  try {
    res.json(require('./refresh-state.json'));
  } catch (e) {
    res.json({
      mode: 'public-consensus',
      refreshedAt: null
    });
  }
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`LineFoundry running on ${port}`);
  });
}
