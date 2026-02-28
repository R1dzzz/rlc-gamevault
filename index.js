const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const RAWG_API_KEY = process.env.RAWG_API_KEY;
const RAWG_BASE = 'https://api.rawg.io/api';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Games endpoint ──────────────────────────────────────────────────────────
app.get('/api/games', async (req, res) => {
  try {
    const {
      search = '',
      page = 1,
      page_size = 20,
      genres = '',
      tags = '',
      ordering = '-rating',
    } = req.query;

    const params = {
      key: RAWG_API_KEY,
      page,
      page_size,
      ordering,
    };

    if (search)  params.search  = search;
    if (genres)  params.genres  = genres;
    if (tags)    params.tags    = tags;

    const { data } = await axios.get(`${RAWG_BASE}/games`, { params });

    // Enrich each game with the highest-res image available
    const games = data.results.map((g) => ({
      id:            g.id,
      name:          g.name,
      slug:          g.slug,
      released:      g.released,
      rating:        g.rating,
      ratings_count: g.ratings_count,
      background_image: g.background_image
        ? g.background_image.replace('/media/', '/media/resize/1280/-/')
        : null,
      genres:  (g.genres  || []).map((x) => x.name),
      tags:    (g.tags    || []).slice(0, 6).map((x) => x.name),
      platforms: (g.platforms || []).map((p) => p.platform.name),
    }));

    res.json({ count: data.count, next: data.next, results: games });
  } catch (err) {
    console.error('[/api/games]', err.message);
    res.status(500).json({ error: 'Failed to fetch games from RAWG.' });
  }
});

// ── Genres endpoint ─────────────────────────────────────────────────────────
app.get('/api/genres', async (req, res) => {
  try {
    const { data } = await axios.get(`${RAWG_BASE}/genres`, {
      params: { key: RAWG_API_KEY },
    });
    res.json(data.results.map((g) => ({ id: g.id, name: g.name, slug: g.slug })));
  } catch (err) {
    console.error('[/api/genres]', err.message);
    res.status(500).json({ error: 'Failed to fetch genres.' });
  }
});

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`🎮 RLC GameVault running on http://localhost:${PORT}`));
}

module.exports = app;
