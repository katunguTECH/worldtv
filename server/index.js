const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const { Agent, setGlobalDispatcher } = require('undici');
const app = express();

const PORT = process.env.PORT || 10000;
const STATIC_DIR = process.env.STATIC_DIR || 'build';

// Connection pooling/keep-alive to reduce per-segment connection overhead
setGlobalDispatcher(new Agent({ connections: 50, keepAliveTimeout: 30000 }));

app.set('trust proxy', true); // so req.ip reflects the real visitor IP behind Render's proxy

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  next();
});
app.use(express.json());

// ---------------- MongoDB ----------------
let usersCollection;
let visitsCollection;
async function initDb() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI not set — user/visit recording disabled');
    return;
  }
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('worldtv');
    usersCollection = db.collection('users');
    visitsCollection = db.collection('visits');
    console.log('Connected to MongoDB');
  } catch (e) {
    console.error('MongoDB connection failed:', e.message);
  }
}
initDb();

// ---------------- users (email capture) ----------------
app.post('/api/users', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!usersCollection) {
    return res.status(503).json({ error: 'Database unavailable' });
  }
  try {
    await usersCollection.updateOne(
      { email },
      { $set: { email, lastSeen: new Date() }, $setOnInsert: { firstSeen: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error:', e.message);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// ---------------- visit tracking ----------------
async function geolocateIp(ip) {
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Local/Unknown', city: 'Local/Unknown' };
  }
  try {
    const cleanIp = ip.replace('::ffff:', '');
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,city`);
    const data = await res.json();
    if (data.status === 'success') {
      return { country: data.country || 'Unknown', city: data.city || 'Unknown' };
    }
  } catch (e) {
    console.warn('Geolocation failed:', e.message);
  }
  return { country: 'Unknown', city: 'Unknown' };
}

app.post('/api/track-visit', async (req, res) => {
  if (!visitsCollection) return res.json({ ok: false });
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const location = await geolocateIp(ip);
    await visitsCollection.insertOne({
      ip,
      country: location.country,
      city: location.city,
      path: req.body?.path || '/',
      timestamp: new Date(),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Visit tracking error:', e.message);
    res.json({ ok: false });
  }
});

// ---------------- admin ----------------
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  if (!visitsCollection || !usersCollection) {
    return res.status(503).json({ error: 'Database unavailable' });
  }
  try {
    const now = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [visitsAllTime, visitsDay, visitsWeek, recentVisits] = await Promise.all([
      visitsCollection.countDocuments({}),
      visitsCollection.countDocuments({ timestamp: { $gte: dayAgo } }),
      visitsCollection.countDocuments({ timestamp: { $gte: weekAgo } }),
      visitsCollection.find({}).sort({ timestamp: -1 }).limit(100).toArray(),
    ]);

    const [usersAllTime, usersDay, usersWeek, allUsers] = await Promise.all([
      usersCollection.countDocuments({}),
      usersCollection.countDocuments({ firstSeen: { $gte: dayAgo } }),
      usersCollection.countDocuments({ firstSeen: { $gte: weekAgo } }),
      usersCollection.find({}).sort({ firstSeen: -1 }).toArray(),
    ]);

    res.json({
      visits: { allTime: visitsAllTime, day: visitsDay, week: visitsWeek, recent: recentVisits },
      users: { allTime: usersAllTime, day: usersDay, week: usersWeek, list: allUsers },
    });
  } catch (e) {
    console.error('Admin stats error:', e.message);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ---------------- channel cache ----------------
let channelCache = { data: [], timestamp: 0 };
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6h

const NAME_MAP = {
  us: 'USA', ca: 'Canada', mx: 'Mexico', gb: 'UK', fr: 'France', de: 'Germany',
  it: 'Italy', es: 'Spain', ru: 'Russia', nl: 'Netherlands', se: 'Sweden', no: 'Norway',
  dk: 'Denmark', fi: 'Finland', pl: 'Poland', tr: 'Turkey', pt: 'Portugal', gr: 'Greece',
  jp: 'Japan', in: 'India', kr: 'South Korea', cn: 'China', tw: 'Taiwan', hk: 'Hong Kong',
  sg: 'Singapore', my: 'Malaysia', ph: 'Philippines', vn: 'Vietnam', th: 'Thailand',
  id: 'Indonesia', pk: 'Pakistan', bd: 'Bangladesh', il: 'Israel', ae: 'UAE',
  sa: 'Saudi Arabia', eg: 'Egypt', za: 'South Africa', ng: 'Nigeria', ke: 'Kenya',
  gh: 'Ghana', br: 'Brazil', ar: 'Argentina', co: 'Colombia', cl: 'Chile', pe: 'Peru',
  au: 'Australia', nz: 'New Zealand',
};
const COUNTRY_CODES = Object.keys(NAME_MAP);

// Verified real YouTube channels (channel ID, not video ID — this always
// resolves to whatever is currently live on that channel, so it never
// goes stale the way a hardcoded video ID would).
const YOUTUBE_LIVE_CHANNELS = [
  { id: 'yt-citizen-tv-kenya', name: 'Citizen TV Kenya', country: 'Kenya', channelId: 'UChBQgieUidXV1CmDxSdRm3g' },
  { id: 'yt-k24-tv-kenya', name: 'K24 TV', country: 'Kenya', channelId: 'UCt3SE-Mvs3WwP7UW-PiFdqQ' },
  { id: 'yt-aljazeera-english', name: 'Al Jazeera English', country: 'International', channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
];

function getYoutubeChannels() {
  return YOUTUBE_LIVE_CHANNELS.map((c) => ({
    id: c.id,
    name: c.name,
    logo: '',
    country: c.country,
    category: 'News',
    language: 'Unknown',
    streamUrl: `https://www.youtube.com/embed/live_stream?channel=${c.channelId}`,
  }));
}

function parseM3U(content, countryName) {
  const lines = content.split('\n');
  const channels = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const idMatch = line.match(/tvg-id="([^"]*)"/);
      current = {
        id: idMatch && idMatch[1] ? idMatch[1] : `iptv-${countryName}-${channels.length}`,
        name: nameMatch ? nameMatch[1].trim() : 'Unknown Channel',
        logo: logoMatch && logoMatch[1] ? logoMatch[1] : '',
        country: countryName,
        category: groupMatch && groupMatch[1] ? groupMatch[1] : 'General',
        language: 'Unknown',
        streamUrl: '',
      };
    } else if (line.startsWith('http') && current) {
      current.streamUrl = line;
      channels.push(current);
      current = null;
    }
  }
  return channels;
}

async function fetchCountry(code) {
  const name = NAME_MAP[code] || code.toUpperCase();
  const urls = [
    `https://raw.githubusercontent.com/iptv-org/iptv/master/streams/${code}.m3u`,
    `https://cdn.jsdelivr.net/gh/iptv-org/iptv@master/streams/${code}.m3u`,
  ];
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 100) {
          const channels = parseM3U(text, name);
          if (channels.length) return channels;
        }
      }
    } catch (e) {
      console.warn(`[${code}] failed: ${e.message}`);
    }
  }
  return [];
}

async function pool(items, limit, worker) {
  const results = [];
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const item = items[i++];
      results.push(...(await worker(item)));
    }
  });
  await Promise.all(workers);
  return results;
}

async function loadChannels() {
  if (channelCache.data.length && Date.now() - channelCache.timestamp < CACHE_DURATION) {
    return channelCache.data;
  }
  console.log('Refreshing channel cache from iptv-org...');
  const iptvChannels = await pool(COUNTRY_CODES, 8, fetchCountry);
  const channels = [...iptvChannels, ...getYoutubeChannels()];
  if (channels.length) channelCache = { data: channels, timestamp: Date.now() };
  return channelCache.data;
}

app.get('/api/channels', async (req, res) => {
  try {
    const channels = await loadChannels();
    res.json({ channels, count: channels.length, cachedAt: channelCache.timestamp });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load channels', message: e.message });
  }
});

app.get('/api/refresh', async (req, res) => {
  channelCache = { data: [], timestamp: 0 };
  const channels = await loadChannels();
  res.json({ channels, count: channels.length });
});

// ---------------- stream proxy ----------------
app.get('/api/proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing url param');

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(req.query.referer ? { Referer: req.query.referer } : {}),
      },
    });

    if (!upstream.ok) return res.status(upstream.status).send(`Upstream error: ${upstream.status}`);

    const contentType = upstream.headers.get('content-type') || '';
    const isManifest = target.includes('.m3u8') || contentType.includes('mpegurl');

    if (isManifest) {
      const text = await upstream.text();

      // Some CDNs return an HTML error page with a 200 status instead of
      // a real HTTP error when a stream has expired. Catch that here
      // instead of forwarding garbage that causes a "corruption" error
      // client-side.
      if (!text.trim().startsWith('#EXTM3U')) {
        return res.status(502).send('Upstream returned invalid playlist');
      }

      const base = new URL(target);
      const rewritten = text
        .split('\n')
        .map((line) => {
          const t = line.trim();
          if (!t) return line;
          if (t.startsWith('#')) {
            const uriMatch = t.match(/URI="([^"]+)"/);
            if (uriMatch) {
              const abs = new URL(uriMatch[1], base).href;
              return t.replace(uriMatch[1], `/api/proxy?url=${encodeURIComponent(abs)}`);
            }
            return line;
          }
          const abs = new URL(t, base).href;
          return `/api/proxy?url=${encodeURIComponent(abs)}`;
        })
        .join('\n');

      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewritten);
    }

    res.set('Content-Type', contentType || 'application/octet-stream');
    // Segments are immutable once published — safe to cache briefly to
    // cut repeat-fetch overhead during rebuffers.
    if (target.includes('.ts') || target.includes('.aac')) {
      res.set('Cache-Control', 'public, max-age=30');
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.send(buffer);
  } catch (e) {
    console.error('Proxy error:', e.message);
    return res.status(502).send('Proxy fetch failed');
  }
});

// ---------------- serve the built frontend ----------------
const staticPath = path.join(__dirname, '..', STATIC_DIR);
app.use(express.static(staticPath));
app.get('*', (req, res) => res.sendFile(path.join(staticPath, 'index.html')));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));