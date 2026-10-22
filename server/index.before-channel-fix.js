const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const { Agent, setGlobalDispatcher } = require('undici');

const app = express();

const PORT = process.env.PORT || 10000;
const STATIC_DIR = process.env.STATIC_DIR || 'build';

// ============================================================
// HTTP CONNECTION POOL
// ============================================================

setGlobalDispatcher(
  new Agent({
    connections: 50,
    keepAliveTimeout: 30000,
  })
);

app.set('trust proxy', true);

// ============================================================
// CORS
// ============================================================

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, x-admin-key'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

// ============================================================
// MONGODB
// ============================================================

let usersCollection = null;
let visitsCollection = null;

async function initDb() {
  if (!process.env.MONGODB_URI) {
    console.warn(
      'MONGODB_URI not set - user/visit recording disabled'
    );
    return;
  }

  try {
    const client = new MongoClient(process.env.MONGODB_URI, {
      family: 4,
    });

    await client.connect();

    const db = client.db('worldtv');

    usersCollection = db.collection('users');
    visitsCollection = db.collection('visits');

    console.log('Connected to MongoDB');
  } catch (e) {
    console.error(
      'MongoDB connection failed:',
      e.message
    );
  }
}

initDb();

// ============================================================
// USER EMAIL CAPTURE
// ============================================================

app.post('/api/users', async (req, res) => {
  const { email } = req.body || {};

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({
      error: 'Valid email required',
    });
  }

  if (!usersCollection) {
    return res.status(503).json({
      error: 'Database unavailable',
    });
  }

  try {
    await usersCollection.updateOne(
      { email },
      {
        $set: {
          email,
          lastSeen: new Date(),
        },
        $setOnInsert: {
          firstSeen: new Date(),
        },
      },
      {
        upsert: true,
      }
    );

    return res.json({
      ok: true,
    });
  } catch (e) {
    console.error('DB error:', e.message);

    return res.status(500).json({
      error: 'Failed to save',
    });
  }
});

// ============================================================
// VISITOR GEOLOCATION
// ============================================================

async function geolocateIp(ip) {
  if (
    !ip ||
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.')
  ) {
    return {
      country: 'Local/Unknown',
      city: 'Local/Unknown',
    };
  }

  try {
    const cleanIp = ip.replace('::ffff:', '');

    const response = await fetch(
      `http://ip-api.com/json/${cleanIp}?fields=status,country,city`
    );

    const data = await response.json();

    if (data.status === 'success') {
      return {
        country: data.country || 'Unknown',
        city: data.city || 'Unknown',
      };
    }
  } catch (e) {
    console.warn(
      'Geolocation failed:',
      e.message
    );
  }

  return {
    country: 'Unknown',
    city: 'Unknown',
  };
}

// ============================================================
// VISIT TRACKING
// ============================================================

app.post('/api/track-visit', async (req, res) => {
  if (!visitsCollection) {
    return res.json({ ok: false });
  }

  try {
    const ip =
      req.ip ||
      req.headers['x-forwarded-for'] ||
      'unknown';

    const location = await geolocateIp(ip);

    await visitsCollection.insertOne({
      ip,
      country: location.country,
      city: location.city,
      path: req.body?.path || '/',
      timestamp: new Date(),
    });

    return res.json({
      ok: true,
    });
  } catch (e) {
    console.error(
      'Visit tracking error:',
      e.message
    );

    return res.json({
      ok: false,
    });
  }
});

// ============================================================
// ADMIN
// ============================================================

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];

  if (
    !process.env.ADMIN_KEY ||
    key !== process.env.ADMIN_KEY
  ) {
    return res.status(401).json({
      error: 'Unauthorized',
    });
  }

  next();
}

app.get(
  '/api/admin/stats',
  requireAdmin,
  async (req, res) => {
    if (!visitsCollection || !usersCollection) {
      return res.status(503).json({
        error: 'Database unavailable',
      });
    }

    try {
      const now = new Date();

      const dayAgo = new Date(
        now - 24 * 60 * 60 * 1000
      );

      const weekAgo = new Date(
        now - 7 * 24 * 60 * 60 * 1000
      );

      const [
        visitsAllTime,
        visitsDay,
        visitsWeek,
        recentVisits,
      ] = await Promise.all([
        visitsCollection.countDocuments({}),

        visitsCollection.countDocuments({
          timestamp: {
            $gte: dayAgo,
          },
        }),

        visitsCollection.countDocuments({
          timestamp: {
            $gte: weekAgo,
          },
        }),

        visitsCollection
          .find({})
          .sort({ timestamp: -1 })
          .limit(100)
          .toArray(),
      ]);

      const [
        usersAllTime,
        usersDay,
        usersWeek,
        allUsers,
      ] = await Promise.all([
        usersCollection.countDocuments({}),

        usersCollection.countDocuments({
          firstSeen: {
            $gte: dayAgo,
          },
        }),

        usersCollection.countDocuments({
          firstSeen: {
            $gte: weekAgo,
          },
        }),

        usersCollection
          .find({})
          .sort({ firstSeen: -1 })
          .toArray(),
      ]);

      return res.json({
        visits: {
          allTime: visitsAllTime,
          day: visitsDay,
          week: visitsWeek,
          recent: recentVisits,
        },

        users: {
          allTime: usersAllTime,
          day: usersDay,
          week: usersWeek,
          list: allUsers,
        },
      });
    } catch (e) {
      console.error(
        'Admin stats error:',
        e.message
      );

      return res.status(500).json({
        error: 'Failed to load stats',
      });
    }
  }
);

// ============================================================
// CHANNEL CACHE
// ============================================================

let channelCache = {
  data: [],
  timestamp: 0,
};

const CACHE_DURATION =
  6 * 60 * 60 * 1000;

// ============================================================
// COUNTRY MAP
// ============================================================

const NAME_MAP = {
  us: 'USA',
  ca: 'Canada',
  mx: 'Mexico',
  gb: 'UK',
  fr: 'France',
  de: 'Germany',
  it: 'Italy',
  es: 'Spain',
  ru: 'Russia',
  nl: 'Netherlands',
  se: 'Sweden',
  no: 'Norway',
  dk: 'Denmark',
  fi: 'Finland',
  pl: 'Poland',
  tr: 'Turkey',
  pt: 'Portugal',
  gr: 'Greece',
  jp: 'Japan',
  in: 'India',
  kr: 'South Korea',
  cn: 'China',
  tw: 'Taiwan',
  hk: 'Hong Kong',
  sg: 'Singapore',
  my: 'Malaysia',
  ph: 'Philippines',
  vn: 'Vietnam',
  th: 'Thailand',
  id: 'Indonesia',
  pk: 'Pakistan',
  bd: 'Bangladesh',
  il: 'Israel',
  ae: 'UAE',
  sa: 'Saudi Arabia',
  eg: 'Egypt',
  za: 'South Africa',
  ng: 'Nigeria',
  ke: 'Kenya',
  gh: 'Ghana',
  br: 'Brazil',
  ar: 'Argentina',
  co: 'Colombia',
  cl: 'Chile',
  pe: 'Peru',
  au: 'Australia',
  nz: 'New Zealand',
};

const COUNTRY_CODES = Object.keys(NAME_MAP);

// ============================================================
// SEO COUNTRY SLUGS
// ============================================================

function slugifyCountry(country) {
  return country
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const COUNTRY_SLUGS = {};

for (const code of COUNTRY_CODES) {
  const country = NAME_MAP[code];

  COUNTRY_SLUGS[slugifyCountry(country)] = {
    code,
    country,
  };
}

// Special International landing page
COUNTRY_SLUGS.international = {
  code: null,
  country: 'International',
};

// ============================================================
// COUNTRY SEO CONTENT
// ============================================================

function getCountrySeo(country, channelCount) {
  const countText =
    channelCount > 0
      ? `${channelCount} live TV channels`
      : 'live TV channels';

  const title =
    country === 'International'
      ? 'International Live TV Channels - Watch Online | WorldTV'
      : `${country} Live TV Channels - Watch Online | WorldTV`;

  const description =
    country === 'International'
      ? `Watch international live TV channels online with WorldTV. Browse news, entertainment, sports and other live television channels from around the world.`
      : `Watch ${country} live TV channels online with WorldTV. Browse ${countText} from ${country}, including news, entertainment, sports and more.`;

  const heading =
    country === 'International'
      ? 'International Live TV Channels'
      : `${country} Live TV Channels`;

  const intro =
    country === 'International'
      ? 'Watch live television from around the world on WorldTV. Explore international news, entertainment, sports and other live channels.'
      : `Watch live television from ${country} on WorldTV. Browse available ${country} TV channels by category and start watching online.`;

  return {
    title,
    description,
    heading,
    intro,
  };
}

// ============================================================
// YOUTUBE LIVE CHANNELS
// ============================================================

const YOUTUBE_LIVE_CHANNELS = [
  {
    id: 'yt-citizen-tv-kenya',
    name: 'Citizen TV Kenya',
    country: 'Kenya',
    channelId: 'UChBQgieUidXV1CmDxSdRm3g',
  },

  {
    id: 'yt-k24-tv-kenya',
    name: 'K24 TV',
    country: 'Kenya',
    channelId: 'UCt3SE-Mvs3WwP7UW-PiFdqQ',
  },

  {
    id: 'yt-aljazeera-english',
    name: 'Al Jazeera English',
    country: 'International',
    channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg',
  },
];

function getYoutubeChannels() {
  return YOUTUBE_LIVE_CHANNELS.map((c) => ({
    id: c.id,
    name: c.name,
    logo: '',
    country: c.country,
    category: 'News',
    language: 'Unknown',
    streamUrl:
      `https://www.youtube.com/embed/live_stream?channel=${c.channelId}`,
  }));
}

// ============================================================
// M3U PARSER
// ============================================================

function parseM3U(content, countryName) {
  const lines = content.split('\n');

  const channels = [];

  let current = null;

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith('#EXTINF:')) {
      const nameMatch =
        line.match(/,(.+)$/);

      const logoMatch =
        line.match(/tvg-logo="([^"]*)"/);

      const groupMatch =
        line.match(/group-title="([^"]*)"/);

      const idMatch =
        line.match(/tvg-id="([^"]*)"/);

      current = {
        id:
          idMatch && idMatch[1]
            ? idMatch[1]
            : `iptv-${countryName}-${channels.length}`,

        name:
          nameMatch && nameMatch[1]
            ? nameMatch[1].trim()
            : 'Unknown Channel',

        logo:
          logoMatch && logoMatch[1]
            ? logoMatch[1]
            : '',

        country: countryName,

        category:
          groupMatch && groupMatch[1]
            ? groupMatch[1]
            : 'General',

        language: 'Unknown',

        streamUrl: '',
      };
    } else if (
      line.startsWith('http') &&
      current
    ) {
      current.streamUrl = line;

      channels.push(current);

      current = null;
    }
  }

  return channels;
}

// ============================================================
// FETCH COUNTRY CHANNELS
// ============================================================

async function fetchCountry(code) {
  const name =
    NAME_MAP[code] ||
    code.toUpperCase();

  const urls = [
    `https://raw.githubusercontent.com/iptv-org/iptv/master/streams/${code}.m3u`,

    `https://cdn.jsdelivr.net/gh/iptv-org/iptv@master/streams/${code}.m3u`,
  ];

  for (const url of urls) {
    try {
      const controller =
        new AbortController();

      const timeout = setTimeout(
        () => controller.abort(),
        10000
      );

      const response = await fetch(
        url,
        {
          signal:
            controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        continue;
      }

      const text =
        await response.text();

      if (
        text &&
        text.length > 100
      ) {
        const channels =
          parseM3U(
            text,
            name
          );

        if (channels.length) {
          return channels;
        }
      }
    } catch (e) {
      console.warn(
        `[${code}] failed: ${e.message}`
      );
    }
  }

  return [];
}

// ============================================================
// CONCURRENT WORKER POOL
// ============================================================

async function pool(
  items,
  limit,
  worker
) {
  const results = [];

  let index = 0;

  const workers = new Array(
    Math.min(
      limit,
      items.length
    )
  )
    .fill(null)
    .map(async () => {
      while (index < items.length) {
        const item =
          items[index++];

        const result =
          await worker(item);

        results.push(
          ...result
        );
      }
    });

  await Promise.all(
    workers
  );

  return results;
}

// ============================================================
// LOAD CHANNELS
// ============================================================

async function loadChannels() {
  if (
    channelCache.data.length &&
    Date.now() -
      channelCache.timestamp <
      CACHE_DURATION
  ) {
    return channelCache.data;
  }

  console.log(
    'Refreshing channel cache from iptv-org...'
  );

  const iptvChannels =
    await pool(
      COUNTRY_CODES,
      8,
      fetchCountry
    );

  const channels = [
    ...iptvChannels,
    ...getYoutubeChannels(),
  ];

  if (channels.length) {
    channelCache = {
      data: channels,
      timestamp: Date.now(),
    };
  }

  return channelCache.data;
}

// ============================================================
// CHANNEL API
// ============================================================

app.get(
  '/api/channels',
  async (req, res) => {
    try {
      const channels =
        await loadChannels();

      return res.json({
        channels,
        count: channels.length,
        cachedAt:
          channelCache.timestamp,
      });
    } catch (e) {
      return res.status(500).json({
        error:
          'Failed to load channels',
        message: e.message,
      });
    }
  }
);

// ============================================================
// REFRESH CHANNEL API
// ============================================================

app.get(
  '/api/refresh',
  async (req, res) => {
    try {
      channelCache = {
        data: [],
        timestamp: 0,
      };

      const channels =
        await loadChannels();

      return res.json({
        channels,
        count: channels.length,
      });
    } catch (e) {
      return res.status(500).json({
        error:
          'Failed to refresh channels',
        message: e.message,
      });
    }
  }
);

// ============================================================
// SEO HELPERS
// ============================================================

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCountryChannels(country) {
  return channelCache.data.filter(
    (channel) =>
      channel.country === country
  );
}

// ============================================================
// COUNTRY LANDING PAGE
// ============================================================

app.get(
  '/tv/:countrySlug',
  async (req, res) => {
    try {
      const slug =
        String(
          req.params.countrySlug || ''
        ).toLowerCase();

      const countryInfo =
        COUNTRY_SLUGS[slug];

      if (!countryInfo) {
        return res.status(404).sendFile(
          path.join(
            __dirname,
            '..',
            STATIC_DIR,
            'index.html'
          )
        );
      }

      // Make sure channel data is available
      await loadChannels();

      const country =
        countryInfo.country;

      const countryChannels =
        getCountryChannels(
          country
        );

      const channelCount =
        countryChannels.length;

      const seo =
        getCountrySeo(
          country,
          channelCount
        );

      const canonical =
        `https://worldtvchannel.online/tv/${slug}`;

      const staticPath =
        path.join(
          __dirname,
          '..',
          STATIC_DIR
        );

      const indexPath =
        path.join(
          staticPath,
          'index.html'
        );

      const fs =
        require('fs');

      let html =
        fs.readFileSync(
          indexPath,
          'utf8'
        );

      // ------------------------------------------------------
      // SEO TITLE
      // ------------------------------------------------------

      html = html.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>${escapeHtml(
          seo.title
        )}</title>`
      );

      // ------------------------------------------------------
      // META DESCRIPTION
      // ------------------------------------------------------

      html = html.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${escapeHtml(
          seo.description
        )}" />`
      );

      // ------------------------------------------------------
      // CANONICAL
      // ------------------------------------------------------

      html = html.replace(
        /<link\s+rel=["']canonical["'][^>]*>/i,
        `<link rel="canonical" href="${canonical}" />`
      );

      // ------------------------------------------------------
      // OPEN GRAPH
      // ------------------------------------------------------

      html = html.replace(
        /<meta\s+property=["']og:url["'][^>]*>/i,
        `<meta property="og:url" content="${canonical}" />`
      );

      html = html.replace(
        /<meta\s+property=["']og:title["'][^>]*>/i,
        `<meta property="og:title" content="${escapeHtml(
          seo.title
        )}" />`
      );

      html = html.replace(
        /<meta\s+property=["']og:description["'][^>]*>/i,
        `<meta property="og:description" content="${escapeHtml(
          seo.description
        )}" />`
      );

      // ------------------------------------------------------
      // TWITTER
      // ------------------------------------------------------

      html = html.replace(
        /<meta\s+name=["']twitter:title["'][^>]*>/i,
        `<meta name="twitter:title" content="${escapeHtml(
          seo.title
        )}" />`
      );

      html = html.replace(
        /<meta\s+name=["']twitter:description["'][^>]*>/i,
        `<meta name="twitter:description" content="${escapeHtml(
          seo.description
        )}" />`
      );

      // ------------------------------------------------------
      // INSERT SEO CONTENT
      // ------------------------------------------------------

      const seoContent = `
        <section
          id="worldtv-country-seo"
          style="
            max-width:1200px;
            margin:0 auto;
            padding:24px;
            color:#d1d5db;
            font-family:Arial,sans-serif;
          "
        >
          <h1 style="
            font-size:32px;
            font-weight:700;
            color:#ffffff;
            margin-bottom:12px;
          ">
            ${escapeHtml(seo.heading)}
          </h1>

          <p style="
            font-size:18px;
            line-height:1.7;
            margin-bottom:12px;
          ">
            ${escapeHtml(seo.intro)}
          </p>

          <p style="
            font-size:16px;
            line-height:1.6;
            color:#9ca3af;
          ">
            WorldTV currently has
            <strong style="color:#ffffff;">
              ${channelCount}
            </strong>
            available channels for
            <strong style="color:#ffffff;">
              ${escapeHtml(country)}
            </strong>.
            Browse the available channels and select a channel
            to watch live.
          </p>

          <div
            style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
              gap:12px;
              margin-top:24px;
            "
          >
            <div style="
              padding:16px;
              background:#1f2937;
              border-radius:10px;
            ">
              <strong style="color:#fff;">
                ${channelCount}
              </strong>
              <br />
              <span style="color:#9ca3af;">
                Live Channels
              </span>
            </div>

            <div style="
              padding:16px;
              background:#1f2937;
              border-radius:10px;
            ">
              <strong style="color:#fff;">
                ${escapeHtml(country)}
              </strong>
              <br />
              <span style="color:#9ca3af;">
                Country
              </span>
            </div>

            <div style="
              padding:16px;
              background:#1f2937;
              border-radius:10px;
            ">
              <strong style="color:#fff;">
                WorldTV
              </strong>
              <br />
              <span style="color:#9ca3af;">
                Live Television
              </span>
            </div>
          </div>
        </section>
      `;

      html = html.replace(
        '</body>',
        `${seoContent}</body>`
      );

      // ------------------------------------------------------
      // COUNTRY DATA FOR FUTURE CLIENT-SIDE USE
      // ------------------------------------------------------

      const countryScript = `
        <script>
          window.__WORLDTV_COUNTRY__ = ${JSON.stringify({
            country,
            slug,
            channelCount,
          })};
        </script>
      `;

      html = html.replace(
        '</head>',
        `${countryScript}</head>`
      );

      // ------------------------------------------------------
      // SEND PAGE
      // ------------------------------------------------------

      res.set(
        'Content-Type',
        'text/html; charset=utf-8'
      );

      return res.send(html);
    } catch (e) {
      console.error(
        'Country landing page error:',
        e.message
      );

      return res.status(500).send(
        'Unable to load country page'
      );
    }
  }
);

// ============================================================
// COUNTRY DIRECTORY
// ============================================================

app.get(
  '/countries',
  async (req, res) => {
    try {
      await loadChannels();

      const countryList =
        Object.values(
          COUNTRY_SLUGS
        ).map((item) => {
          const slug =
            slugifyCountry(
              item.country
            );

          return {
            country: item.country,
            slug,
            url:
              `https://worldtvchannel.online/tv/${slug}`,
            channels:
              getCountryChannels(
                item.country
              ).length,
          };
        });

      const staticPath =
        path.join(
          __dirname,
          '..',
          STATIC_DIR
        );

      const fs =
        require('fs');

      const indexPath =
        path.join(
          staticPath,
          'index.html'
        );

      let html =
        fs.readFileSync(
          indexPath,
          'utf8'
        );

      html = html.replace(
        /<title>[\s\S]*?<\/title>/i,
        '<title>Countries - Watch Live TV From Around the World | WorldTV</title>'
      );

      html = html.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        '<meta name="description" content="Browse WorldTV live TV channels by country. Watch live television from countries around the world." />'
      );

      html = html.replace(
        /<link\s+rel=["']canonical["'][^>]*>/i,
        '<link rel="canonical" href="https://worldtvchannel.online/countries" />'
      );

      const links = countryList
        .map(
          (item) => `
            <li style="margin:8px 0;">
              <a
                href="/tv/${escapeHtml(item.slug)}"
                style="color:#60a5fa;"
              >
                ${escapeHtml(item.country)}
              </a>
              -
              ${item.channels} channels
            </li>
          `
        )
        .join('');

      const countryHtml = `
        <section
          style="
            max-width:1200px;
            margin:0 auto;
            padding:30px;
            color:#d1d5db;
            font-family:Arial,sans-serif;
          "
        >
          <h1 style="
            color:#fff;
            font-size:36px;
            margin-bottom:16px;
          ">
            Watch Live TV by Country
          </h1>

          <p style="
            font-size:18px;
            line-height:1.7;
          ">
            Explore WorldTV live television channels from
            countries around the world.
          </p>

          <ul>
            ${links}
          </ul>
        </section>
      `;

      html = html.replace(
        '</body>',
        `${countryHtml}</body>`
      );

      res.set(
        'Content-Type',
        'text/html; charset=utf-8'
      );

      return res.send(html);
    } catch (e) {
      console.error(
        'Countries page error:',
        e.message
      );

      return res.status(500).send(
        'Unable to load countries'
      );
    }
  }
);

// ============================================================
// XML SITEMAP
// ============================================================

app.get(
  '/sitemap.xml',
  async (req, res) => {
    try {
      await loadChannels();

      const today =
        new Date()
          .toISOString()
          .split('T')[0];

      const urls = [];

      // Homepage
      urls.push(`
        <url>
          <loc>https://worldtvchannel.online/</loc>
          <changefreq>daily</changefreq>
          <priority>1.0</priority>
          <lastmod>${today}</lastmod>
        </url>
      `);

      // Countries directory
      urls.push(`
        <url>
          <loc>https://worldtvchannel.online/countries</loc>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
          <lastmod>${today}</lastmod>
        </url>
      `);

      // Individual country landing pages
      for (const item of Object.values(
        COUNTRY_SLUGS
      )) {
        const slug =
          slugifyCountry(
            item.country
          );

        const channelCount =
          getCountryChannels(
            item.country
          ).length;

        // Only include country pages
        // that actually have channels,
        // except International.
        if (
          channelCount === 0 &&
          item.country !== 'International'
        ) {
          continue;
        }

        urls.push(`
          <url>
            <loc>https://worldtvchannel.online/tv/${escapeHtml(
              slug
            )}</loc>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
            <lastmod>${today}</lastmod>
          </url>
        `);
      }

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
${urls.join('\n')}
</urlset>`;

      res.set(
        'Content-Type',
        'application/xml; charset=utf-8'
      );

      res.set(
        'Cache-Control',
        'public, max-age=3600'
      );

      return res.send(sitemap);
    } catch (e) {
      console.error(
        'Sitemap error:',
        e.message
      );

      return res.status(500).send(
        'Unable to generate sitemap'
      );
    }
  }
);

// ============================================================
// ROBOTS.TXT
// ============================================================

app.get(
  '/robots.txt',
  (req, res) => {
    const robots = `# WorldTV robots.txt

User-agent: *
Allow: /

Sitemap: https://worldtvchannel.online/sitemap.xml
`;

    res.set(
      'Content-Type',
      'text/plain; charset=utf-8'
    );

    return res.send(robots);
  }
);

// ============================================================
// STREAM PROXY
// ============================================================

app.get(
  '/api/proxy',
  async (req, res) => {
    const target = req.query.url;

    if (!target) {
      return res
        .status(400)
        .send('Missing url param');
    }

    try {
      const upstream =
        await fetch(
          target,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',

              ...(req.query.referer
                ? {
                    Referer:
                      req.query.referer,
                  }
                : {}),
            },
          }
        );

      if (!upstream.ok) {
        return res
          .status(upstream.status)
          .send(
            `Upstream error: ${upstream.status}`
          );
      }

      const contentType =
        upstream.headers.get(
          'content-type'
        ) || '';

      const isManifest =
        String(target).includes('.m3u8') ||
        contentType.includes(
          'mpegurl'
        );

      // ------------------------------------------------------
      // M3U8 MANIFEST
      // ------------------------------------------------------

      if (isManifest) {
        const text =
          await upstream.text();

        if (
          !text
            .trim()
            .startsWith('#EXTM3U')
        ) {
          return res
            .status(502)
            .send(
              'Upstream returned invalid playlist'
            );
        }

        const base =
          new URL(target);

        const rewritten =
          text
            .split('\n')
            .map((line) => {
              const t =
                line.trim();

              if (!t) {
                return line;
              }

              if (
                t.startsWith('#')
              ) {
                const uriMatch =
                  t.match(
                    /URI="([^"]+)"/
                  );

                if (uriMatch) {
                  const absolute =
                    new URL(
                      uriMatch[1],
                      base
                    ).href;

                  return t.replace(
                    uriMatch[1],
                    `/api/proxy?url=${encodeURIComponent(
                      absolute
                    )}`
                  );
                }

                return line;
              }

              const absolute =
                new URL(
                  t,
                  base
                ).href;

              return `/api/proxy?url=${encodeURIComponent(
                absolute
              )}`;
            })
            .join('\n');

        res.set(
          'Content-Type',
          'application/vnd.apple.mpegurl'
        );

        return res.send(
          rewritten
        );
      }

      // ------------------------------------------------------
      // VIDEO / AUDIO SEGMENTS
      // ------------------------------------------------------

      res.set(
        'Content-Type',
        contentType ||
          'application/octet-stream'
      );

      if (
        String(target).includes(
          '.ts'
        ) ||
        String(target).includes(
          '.aac'
        )
      ) {
        res.set(
          'Cache-Control',
          'public, max-age=30'
        );
      }

      const buffer =
        Buffer.from(
          await upstream.arrayBuffer()
        );

      return res.send(
        buffer
      );
    } catch (e) {
      console.error(
        'Proxy error:',
        e.message
      );

      return res
        .status(502)
        .send(
          'Proxy fetch failed'
        );
    }
  }
);

// ============================================================
// SERVE REACT BUILD
// ============================================================

const staticPath =
  path.join(
    __dirname,
    '..',
    STATIC_DIR
  );

app.use(
  express.static(staticPath)
);

// ============================================================
// REACT FALLBACK
// ============================================================

app.get(
  '*',
  (req, res) => {
    res.sendFile(
      path.join(
        staticPath,
        'index.html'
      )
    );
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {
    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `Static directory: ${staticPath}`
    );

    console.log(
      `Country SEO pages: ${Object.keys(
        COUNTRY_SLUGS
      ).length}`
    );
  }
);