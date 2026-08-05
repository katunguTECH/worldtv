const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 10000;
const STATIC_DIR = process.env.STATIC_DIR || 'build'; // 'dist' if you're on Vite

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
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
  const channels = await pool(COUNTRY_CODES, 8, fetchCountry);
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
// Fetches the manifest/segment server-side so the browser never hits CORS
// or referrer blocks on random stream hosts. Rewrites .m3u8 URIs to route
// back through this same proxy.
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