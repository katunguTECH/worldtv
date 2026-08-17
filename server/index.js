const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const { Agent, setGlobalDispatcher } = require('undici');
const rateLimit = require('express-rate-limit');

const { validateEmailAddress } = require('./emailValidation');
const { sendConfirmationEmail } = require('./mailer');

const app = express();

const STATIC_DIR = process.env.STATIC_DIR || 'build';

// ============================================================
// HTTP / CONNECTION SETTINGS
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
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );
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
// RATE LIMITING
// ============================================================

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts from this address. Please try again later.' },
});

const confirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// STATIC FRONTEND ASSETS
// ============================================================
// Serves JS/CSS/images/etc. from the React build folder.
// This does NOT serve index.html for arbitrary routes - the
// catch-all below (after all API/SEO routes) handles that.

app.use(
  express.static(
    path.join(__dirname, '..', STATIC_DIR)
  )
);

// ============================================================
// MONGODB
// ============================================================

let usersCollection = null;
let visitsCollection = null;
let mongoClient = null;

async function initDb() {
  if (!process.env.MONGODB_URI) {
    console.warn(
      'MONGODB_URI not set - user/visit recording disabled'
    );
    return;
  }

  try {
    mongoClient = new MongoClient(
      process.env.MONGODB_URI,
      {
        family: 4,
      }
    );

    await mongoClient.connect();

    const db = mongoClient.db('worldtv');

    usersCollection = db.collection('users');
    visitsCollection = db.collection('visits');

    console.log('Connected to MongoDB');
  } catch (error) {
    console.error(
      'MongoDB connection failed:',
      error.message
    );
  }
}

initDb();

// ============================================================
// USERS - EMAIL CAPTURE
// ============================================================

const CONFIRMATION_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

app.post('/api/users', signupLimiter, async (req, res) => {
  const { email, website } = req.body || {};

  // Honeypot: "website" is hidden from real users via CSS. Bots that
  // auto-fill every field will populate it. Pretend success, save nothing.
  if (website && String(website).trim() !== '') {
    return res.json({ ok: true, status: 'pending' });
  }

  if (!usersCollection) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();

  const validation = await validateEmailAddress(normalizedEmail);
  if (!validation.valid) {
    const messages = {
      missing_email: 'Email is required.',
      invalid_syntax: "That doesn't look like a valid email address.",
      disposable_domain: "Temporary or disposable email addresses aren't accepted. Please use a permanent address.",
      no_mx_record: "This email domain can't receive mail. Please check for typos.",
    };
    return res.status(400).json({
      error: messages[validation.reason] || 'Invalid email address.',
      reason: validation.reason,
    });
  }

  try {
    const existing = await usersCollection.findOne({ email: normalizedEmail });

    if (existing && existing.verified) {
      // Already confirmed on a previous visit — nothing to send, just tell
      // the frontend it's good to go.
      return res.json({ ok: true, status: 'verified' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const confirmationExpires = new Date(Date.now() + CONFIRMATION_EXPIRY_MS);

    await usersCollection.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          email: normalizedEmail,
          lastSeen: new Date(),
          verified: false,
          confirmationToken: token,
          confirmationExpires,
          signupIp: req.ip,
        },
        $setOnInsert: {
          firstSeen: new Date(),
        },
      },
      { upsert: true }
    );

    await sendConfirmationEmail(normalizedEmail, token);

    return res.json({
      ok: true,
      status: 'pending',
      message: 'Check your inbox to confirm your email, then come back and refresh.',
    });
  } catch (error) {
    console.error('DB error:', error.message);
    return res.status(500).json({ error: 'Failed to save' });
  }
});

// Frontend polls this to find out whether a pending signup has been
// confirmed yet, so it can unlock playback without a full page reload.
app.get('/api/users/status', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();

  if (!email || !usersCollection) {
    return res.status(400).json({ verified: false });
  }

  try {
    const user = await usersCollection.findOne({ email });
    return res.json({ verified: !!(user && user.verified) });
  } catch (error) {
    console.error('Status check error:', error.message);
    return res.status(500).json({ verified: false });
  }
});

// Confirmation link target — clicked from the email.
app.get('/api/confirm/:token', confirmLimiter, async (req, res) => {
  const { token } = req.params;

  if (!usersCollection) {
    return res.status(503).send(renderConfirmPage(false, 'Database unavailable.'));
  }

  try {
    const user = await usersCollection.findOne({ confirmationToken: token });

    if (!user) {
      return res.status(400).send(renderConfirmPage(false, 'This confirmation link is invalid or has already been used.'));
    }
    if (user.confirmationExpires && new Date(user.confirmationExpires) < new Date()) {
      return res.status(400).send(renderConfirmPage(false, 'This confirmation link has expired. Please enter your email again.'));
    }

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: { verified: true, verifiedAt: new Date() },
        $unset: { confirmationToken: '', confirmationExpires: '' },
      }
    );

    return res.status(200).send(renderConfirmPage(true, 'Your email is confirmed! Go back to WorldTV and refresh to start watching.'));
  } catch (error) {
    console.error('Confirm error:', error.message);
    return res.status(500).send(renderConfirmPage(false, 'Something went wrong confirming your email.'));
  }
});

function renderConfirmPage(success, message) {
  const siteUrl = process.env.SITE_URL || 'https://worldtvchannel.online';
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>WorldTV</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 60px 20px;">
        <h1 style="color: ${success ? '#16a34a' : '#dc2626'};">${success ? '✓ Confirmed' : '✗ Not confirmed'}</h1>
        <p>${message}</p>
        <a href="${siteUrl}">Return to WorldTV</a>
      </body>
    </html>
  `;
}

// ============================================================
// VISITOR GEOLOCATION
// ============================================================

async function geolocateIp(ip) {
  if (
    !ip ||
    ip === 'unknown' ||
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
    const cleanIp = String(ip)
      .replace('::ffff:', '')
      .split(',')[0]
      .trim();

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 5000);

    try {
      const response = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(
          cleanIp
        )}?fields=status,country,city`,
        {
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        return {
          country: 'Unknown',
          city: 'Unknown',
        };
      }

      const data = await response.json();

      if (data.status === 'success') {
        return {
          country: data.country || 'Unknown',
          city: data.city || 'Unknown',
        };
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn(
      'Geolocation failed:',
      error.message
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
    return res.json({
      ok: false,
    });
  }

  try {
    const forwarded =
      req.headers['x-forwarded-for'];

    const ip =
      req.ip ||
      forwarded ||
      'unknown';

    const location =
      await geolocateIp(ip);

    await visitsCollection.insertOne({
      ip,
      country: location.country,
      city: location.city,
      path:
        req.body?.path ||
        '/',
      timestamp: new Date(),
    });

    return res.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      'Visit tracking error:',
      error.message
    );

    return res.json({
      ok: false,
    });
  }
});

// ============================================================
// ADMIN AUTHENTICATION
// ============================================================

function requireAdmin(req, res, next) {
  const key =
    req.headers['x-admin-key'];

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

// ============================================================
// ADMIN STATS
// ============================================================

app.get(
  '/api/admin/stats',
  requireAdmin,
  async (req, res) => {
    if (
      !visitsCollection ||
      !usersCollection
    ) {
      return res.status(503).json({
        error: 'Database unavailable',
      });
    }

    try {
      const now = new Date();

      const dayAgo = new Date(
        now.getTime() -
          24 * 60 * 60 * 1000
      );

      const weekAgo = new Date(
        now.getTime() -
          7 * 24 * 60 * 60 * 1000
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
          .sort({
            timestamp: -1,
          })
          .limit(100)
          .toArray(),
      ]);

      const [
        usersAllTime,
        usersVerifiedAllTime,
        usersDay,
        usersWeek,
        allUsers,
      ] = await Promise.all([
        usersCollection.countDocuments({}),

        usersCollection.countDocuments({
          verified: true,
        }),

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
          .sort({
            firstSeen: -1,
          })
          .toArray(),
      ]);

      const conversionRatePercent = visitsAllTime > 0
        ? Number(((usersVerifiedAllTime / visitsAllTime) * 100).toFixed(2))
        : 0;

      return res.json({
        visits: {
          allTime: visitsAllTime,
          day: visitsDay,
          week: visitsWeek,
          recent: recentVisits,
        },

        users: {
          allTime: usersAllTime,
          verifiedAllTime: usersVerifiedAllTime,
          day: usersDay,
          week: usersWeek,
          list: allUsers.map((u) => ({
            email: u.email,
            verified: !!u.verified,
            firstSeen: u.firstSeen,
            lastSeen: u.lastSeen,
            verifiedAt: u.verifiedAt || null,
          })),
        },

        funnel: {
          visitsAllTime,
          verifiedUsersAllTime: usersVerifiedAllTime,
          conversionRatePercent,
        },
      });
    } catch (error) {
      console.error(
        'Admin stats error:',
        error.message
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

const COUNTRY_CODES =
  Object.keys(NAME_MAP);

// ============================================================
// UPSTREAM FILENAME OVERRIDES
// ============================================================
// iptv-org's repo doesn't always name playlist files after the
// ISO code we use internally for display/SEO purposes.
// gb -> uk is the known mismatch (their file is streams/uk.m3u).
// Add further overrides here if other codes are found to 404.

const UPSTREAM_CODE_MAP = {
  gb: 'uk',
};

// ============================================================
// SEO COUNTRY SLUGS
// ============================================================

function slugifyCountry(country) {
  return String(country)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const COUNTRY_SLUGS = {};

for (const code of COUNTRY_CODES) {
  const country = NAME_MAP[code];

  COUNTRY_SLUGS[
    slugifyCountry(country)
  ] = {
    code,
    country,
  };
}

COUNTRY_SLUGS.international = {
  code: null,
  country: 'International',
};

// ============================================================
// COUNTRY SEO CONTENT
// ============================================================

function getCountrySeo(
  country,
  channelCount
) {
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
      ? 'Watch international live TV channels online with WorldTV. Browse news, entertainment, sports and other live television channels from around the world.'
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
    channelId:
      'UChBQgieUidXV1CmDxSdRm3g',
  },

  {
    id: 'yt-k24-tv-kenya',
    name: 'K24 TV',
    country: 'Kenya',
    channelId:
      'UCt3SE-Mvs3WwP7UW-PiFdqQ',
  },

  {
    id: 'yt-aljazeera-english',
    name: 'Al Jazeera English',
    country: 'International',
    channelId:
      'UCNye-wNBqNL5ZzHSJj3l8Bg',
  },
];

function getYoutubeChannels() {
  return YOUTUBE_LIVE_CHANNELS.map(
    (channel) => ({
      id: channel.id,
      name: channel.name,
      logo: '',
      country: channel.country,
      category: 'News',
      language: 'Unknown',

      streamUrl:
        `https://www.youtube.com/embed/live_stream?channel=${channel.channelId}`,
    })
  );
}

// ============================================================
// M3U PARSER
// ============================================================

function parseM3U(
  content,
  countryName
) {
  const lines =
    String(content).split('\n');

  const channels = [];

  let current = null;

  for (const raw of lines) {
    const line =
      String(raw).trim();

    if (
      line.startsWith('#EXTINF:')
    ) {
      const nameMatch =
        line.match(/,(.+)$/);

      const logoMatch =
        line.match(
          /tvg-logo="([^"]*)"/
        );

      const groupMatch =
        line.match(
          /group-title="([^"]*)"/
        );

      const idMatch =
        line.match(
          /tvg-id="([^"]*)"/
        );

      current = {
        id:
          idMatch &&
          idMatch[1]
            ? idMatch[1]
            : `iptv-${countryName}-${channels.length}`,

        name:
          nameMatch &&
          nameMatch[1]
            ? nameMatch[1].trim()
            : 'Unknown Channel',

        logo:
          logoMatch &&
          logoMatch[1]
            ? logoMatch[1]
            : '',

        country:
          countryName,

        category:
          groupMatch &&
          groupMatch[1]
            ? groupMatch[1]
            : 'General',

        language:
          'Unknown',

        streamUrl:
          '',
      };
    } else if (
      line.startsWith('http') &&
      current
    ) {
      current.streamUrl =
        line;

      channels.push(
        current
      );

      current = null;
    }
  }

  return channels;
}

// ============================================================
// IPTV REQUEST SETTINGS
// ============================================================

const CHANNEL_REQUEST_TIMEOUT =
  7000;

const CHANNEL_POOL_SIZE = 6;

// ============================================================
// FETCH COUNTRY CHANNELS
// ============================================================

async function fetchCountry(code) {
  const name =
    NAME_MAP[code] ||
    code.toUpperCase();

  // Use the upstream's actual filename when it differs from
  // our internal ISO code (e.g. gb -> uk).
  const upstreamCode =
    UPSTREAM_CODE_MAP[code] || code;

  const urls = [
    `https://raw.githubusercontent.com/iptv-org/iptv/master/streams/${upstreamCode}.m3u`,
    `https://cdn.jsdelivr.net/gh/iptv-org/iptv@master/streams/${upstreamCode}.m3u`,
  ];

  for (const url of urls) {
    let timeout = null;

    try {
      const controller =
        new AbortController();

      timeout = setTimeout(() => {
        controller.abort();
      }, CHANNEL_REQUEST_TIMEOUT);

      const response =
        await fetch(
          url,
          {
            signal:
              controller.signal,

            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0 Safari/537.36',

              Accept:
                'application/x-mpegURL,text/plain,*/*',
            },
          }
        );

      clearTimeout(timeout);
      timeout = null;

      if (!response.ok) {
        console.warn(
          `[${code}] HTTP ${response.status}`
        );

        continue;
      }

      const text =
        await response.text();

      if (
        !text ||
        text.length < 100
      ) {
        console.warn(
          `[${code}] empty or invalid playlist`
        );

        continue;
      }

      const channels =
        parseM3U(
          text,
          name
        );

      if (
        channels.length > 0
      ) {
        console.log(
          `[${code}] ${channels.length} channels`
        );

        return channels;
      }

      console.warn(
        `[${code}] playlist contained no channels`
      );
    } catch (error) {
      if (timeout) {
        clearTimeout(timeout);
      }

      console.warn(
        `[${code}] failed: ${error.message}`
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

  const workerCount =
    Math.min(
      limit,
      items.length
    );

  const workers =
    new Array(workerCount)
      .fill(null)
      .map(async () => {
        while (
          index <
          items.length
        ) {
          const currentIndex =
            index++;

          const item =
            items[
              currentIndex
            ];

          try {
            const result =
              await worker(item);

            if (
              Array.isArray(result)
            ) {
              results.push(
                ...result
              );
            }
          } catch (error) {
            console.warn(
              'Channel worker failed:',
              error.message
            );
          }
        }
      });

  await Promise.all(
    workers
  );

  return results;
}

// ============================================================
// CHANNEL LOAD LOCK
// ============================================================

// This prevents several browser/API requests from triggering
// separate 48-country refreshes at the same time.
let channelLoadPromise = null;

// ============================================================
// LOAD CHANNELS - NON-BLOCKING / SAFE
// ============================================================

async function loadChannels(
  options = {}
) {
  const forceRefresh =
    options.forceRefresh === true;

  // ----------------------------------------------------------
  // RETURN VALID CACHE IMMEDIATELY
  // ----------------------------------------------------------

  if (
    !forceRefresh &&
    channelCache.data.length > 0 &&
    Date.now() -
      channelCache.timestamp <
      CACHE_DURATION
  ) {
    return channelCache.data;
  }

  // ----------------------------------------------------------
  // REUSE AN EXISTING REFRESH
  // ----------------------------------------------------------

  if (channelLoadPromise) {
    return channelLoadPromise;
  }

  // ----------------------------------------------------------
  // START ONE REFRESH
  // ----------------------------------------------------------

  channelLoadPromise =
    (async () => {
      try {
        console.log(
          'Refreshing channel cache from iptv-org...'
        );

        const iptvChannels =
          await pool(
            COUNTRY_CODES,
            CHANNEL_POOL_SIZE,
            fetchCountry
          );

        const youtubeChannels =
          getYoutubeChannels();

        const channels = [
          ...iptvChannels,
          ...youtubeChannels,
        ];

        // ----------------------------------------------------
        // ONLY REPLACE CACHE IF WE RECEIVED CHANNELS
        // ----------------------------------------------------

        if (
          channels.length > 0
        ) {
          channelCache = {
            data: channels,
            timestamp:
              Date.now(),
          };

          console.log(
            `Channel cache refreshed successfully: ${channels.length} channels`
          );
        } else {
          console.warn(
            'Channel refresh returned no channels. Existing cache preserved.'
          );
        }

        return channelCache.data;
      } catch (error) {
        console.error(
          'Channel refresh failed:',
          error.message
        );

        // Preserve any existing cache.
        return channelCache.data;
      } finally {
        channelLoadPromise =
          null;
      }
    })();

  return channelLoadPromise;
}

// ============================================================
// CHANNEL API
// ============================================================

app.get(
  '/api/channels',
  async (req, res) => {
    try {
      // ------------------------------------------------------
      // CACHE EXISTS
      // ------------------------------------------------------

      if (
        channelCache.data.length >
        0
      ) {
        const stale =
          Date.now() -
            channelCache.timestamp >=
          CACHE_DURATION;

        // If stale, refresh in background.
        if (
          stale &&
          !channelLoadPromise
        ) {
          loadChannels().catch(
            (error) => {
              console.warn(
                'Background channel refresh failed:',
                error.message
              );
            }
          );
        }

        return res.json({
          channels:
            channelCache.data,

          count:
            channelCache.data.length,

          cachedAt:
            channelCache.timestamp,

          loading:
            Boolean(
              channelLoadPromise
            ),
        });
      }

      // ------------------------------------------------------
      // NO CACHE YET
      // ------------------------------------------------------

      const channels =
        await loadChannels();

      return res.json({
        channels,
        count:
          channels.length,

        cachedAt:
          channelCache.timestamp,

        loading: false,
      });
    } catch (error) {
      console.error(
        'Channels API error:',
        error.message
      );

      return res.status(500).json({
        error:
          'Failed to load channels',

        message:
          error.message,
      });
    }
  }
);

// ============================================================
// FORCE CHANNEL REFRESH
// ============================================================

app.get(
  '/api/refresh',
  async (req, res) => {
    try {
      const channels =
        await loadChannels({
          forceRefresh: true,
        });

      return res.json({
        channels,
        count:
          channels.length,

        cachedAt:
          channelCache.timestamp,
      });
    } catch (error) {
      console.error(
        'Channel refresh error:',
        error.message
      );

      return res.status(500).json({
        error:
          'Failed to refresh channels',

        message:
          error.message,
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
  const targetCountry = String(country || '').trim().toLowerCase();

  if (!targetCountry) {
    return [];
  }

  return channelCache.data.filter((channel) => {
    const channelCountry = String(
      channel.country || ''
    ).trim().toLowerCase();

    return channelCountry === targetCountry;
  });
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
          req.params.countrySlug ||
            ''
        ).toLowerCase();

      const countryInfo =
        COUNTRY_SLUGS[slug];

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

      // ------------------------------------------------------
      // UNKNOWN COUNTRY
      // ------------------------------------------------------

      if (!countryInfo) {
        return res.status(404).sendFile(
          indexPath
        );
      }

      // ------------------------------------------------------
      // DO NOT BLOCK THE SEO PAGE
      // ------------------------------------------------------

      // If no channel cache exists, begin loading channels
      // in the background. The page itself is returned
      // immediately.
      if (
        channelCache.data.length === 0 &&
        !channelLoadPromise
      ) {
        loadChannels().catch(
          (error) => {
            console.warn(
              'Background channel loading failed:',
              error.message
            );
          }
        );
      }

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

      // ------------------------------------------------------
      // READ FRONTEND
      // ------------------------------------------------------

      let html =
        fs.readFileSync(
          indexPath,
          'utf8'
        );

      // ------------------------------------------------------
      // TITLE
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
      // SEO CONTENT
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
  <h1
    style="
      font-size:32px;
      font-weight:700;
      color:#ffffff;
      margin-bottom:12px;
    "
  >
    ${escapeHtml(seo.heading)}
  </h1>

  <p
    style="
      font-size:18px;
      line-height:1.7;
      margin-bottom:12px;
    "
  >
    ${escapeHtml(seo.intro)}
  </p>

  <p
    style="
      font-size:16px;
      line-height:1.6;
      color:#9ca3af;
    "
  >
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
    <div
      style="
        padding:16px;
        background:#1f2937;
        border-radius:10px;
      "
    >
      <strong style="color:#fff;">
        ${channelCount}
      </strong>
      <br />
      <span style="color:#9ca3af;">
        Live Channels
      </span>
    </div>

    <div
      style="
        padding:16px;
        background:#1f2937;
        border-radius:10px;
      "
    >
      <strong style="color:#fff;">
        ${escapeHtml(country)}
      </strong>
      <br />
      <span style="color:#9ca3af;">
        Country
      </span>
    </div>

    <div
      style="
        padding:16px;
        background:#1f2937;
        border-radius:10px;
      "
    >
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
      // COUNTRY DATA FOR CLIENT
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

      return res.send(
        html
      );
    } catch (error) {
      console.error(
        'Country landing page error:',
        error.message
      );

      return res.status(500).send(
        'Unable to load country page'
      );
    }
  }
);

// ============================================================
// COUNTRIES DIRECTORY
// ============================================================

app.get(
  '/countries',
  async (req, res) => {
    try {
      // Start channel loading in the background.
      // Do NOT block the countries page.
      if (
        channelCache.data.length === 0 &&
        !channelLoadPromise
      ) {
        loadChannels().catch(
          (error) => {
            console.warn(
              'Background channel loading failed:',
              error.message
            );
          }
        );
      }

      const countryList =
        Object.values(
          COUNTRY_SLUGS
        ).map((item) => {
          const slug =
            slugifyCountry(
              item.country
            );

          return {
            country:
              item.country,

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

      // ------------------------------------------------------
      // TITLE
      // ------------------------------------------------------

      html = html.replace(
        /<title>[\s\S]*?<\/title>/i,
        '<title>Countries - Watch Live TV From Around the World | WorldTV</title>'
      );

      // ------------------------------------------------------
      // DESCRIPTION
      // ------------------------------------------------------

      html = html.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        '<meta name="description" content="Browse WorldTV live TV channels by country. Watch live television from countries around the world." />'
      );

      // ------------------------------------------------------
      // CANONICAL
      // ------------------------------------------------------

      html = html.replace(
        /<link\s+rel=["']canonical["'][^>]*>/i,
        '<link rel="canonical" href="https://worldtvchannel.online/countries" />'
      );

      // ------------------------------------------------------
      // COUNTRY LINKS
      // ------------------------------------------------------

      const links =
        countryList
          .map(
            (item) => `
<li style="margin:8px 0;">
  <a
    href="/tv/${escapeHtml(
      item.slug
    )}"
    style="color:#60a5fa;"
  >
    ${escapeHtml(
      item.country
    )}
  </a>
  - ${item.channels} channels
</li>
`
          )
          .join('');

      // ------------------------------------------------------
      // COUNTRY HTML
      // ------------------------------------------------------

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
  <h1
    style="
      color:#fff;
      font-size:36px;
      margin-bottom:16px;
    "
  >
    Watch Live TV by Country
  </h1>

  <p
    style="
      font-size:18px;
      line-height:1.7;
    "
  >
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

      return res.send(
        html
      );
    } catch (error) {
      console.error(
        'Countries page error:',
        error.message
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
      // Sitemap should not hang waiting for IPTV sources.
      if (
        channelCache.data.length === 0 &&
        !channelLoadPromise
      ) {
        loadChannels().catch(
          (error) => {
            console.warn(
              'Background sitemap channel loading failed:',
              error.message
            );
          }
        );
      }

      const today =
        new Date()
          .toISOString()
          .split('T')[0];

      const urls = [];

      // ------------------------------------------------------
      // HOMEPAGE
      // ------------------------------------------------------

      urls.push(`
<url>
  <loc>https://worldtvchannel.online/</loc>
  <changefreq>daily</changefreq>
  <priority>1.0</priority>
  <lastmod>${today}</lastmod>
</url>
`);

      // ------------------------------------------------------
      // COUNTRIES DIRECTORY
      // ------------------------------------------------------

      urls.push(`
<url>
  <loc>https://worldtvchannel.online/countries</loc>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
  <lastmod>${today}</lastmod>
</url>
`);

      // ------------------------------------------------------
      // COUNTRY PAGES
      // ------------------------------------------------------

      for (
        const item of Object.values(
          COUNTRY_SLUGS
        )
      ) {
        const slug =
          slugifyCountry(
            item.country
          );

        const channelCount =
          getCountryChannels(
            item.country
          ).length;

        if (
          channelCount === 0 &&
          item.country !==
            'International'
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

      return res.send(
        sitemap
      );
    } catch (error) {
      console.error(
        'Sitemap error:',
        error.message
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

    return res.send(
      robots
    );
  }
);

// ============================================================
// STREAM PROXY
// ============================================================

app.get('/api/proxy', async (req, res) => {
  const target = req.query.url;

  if (!target) {
    return res.status(400).send('Missing url param');
  }

  let targetUrl;

  try {
    targetUrl = new URL(String(target));
  } catch {
    return res.status(400).send('Invalid url param');
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).send('Unsupported URL protocol');
  }

  /*
   * ----------------------------------------------------------
   * UPSTREAM REQUEST CONFIGURATION
   * ----------------------------------------------------------
   *
   * IPTV providers frequently require:
   *
   * - User-Agent
   * - Referer
   * - Origin
   * - Accept
   * - Keep-alive
   *
   * We preserve these where supplied by the original request.
   */

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0 Safari/537.36',

    Accept:
      '*/*',

    Connection:
      'keep-alive',
  };

  if (req.query.referer) {
    headers.Referer = String(req.query.referer);
  }

  if (req.query.origin) {
    headers.Origin = String(req.query.origin);
  }

  /*
   * Some IPTV URLs contain tokens which expire quickly.
   * Do not cache manifests.
   */

  const targetString = targetUrl.href.toLowerCase();

  const looksLikeManifest =
    targetString.includes('.m3u8') ||
    targetString.includes('.m3u');

  try {
    /*
     * --------------------------------------------------------
     * FETCH UPSTREAM
     * --------------------------------------------------------
     */

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, looksLikeManifest ? 15000 : 30000);

    let upstream;

    try {
      upstream = await fetch(targetUrl.href, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    /*
     * --------------------------------------------------------
     * UPSTREAM STATUS
     * --------------------------------------------------------
     */

    if (!upstream.ok) {
      console.warn(
        `Proxy upstream error ${upstream.status}: ${targetUrl.href}`
      );

      return res
        .status(upstream.status)
        .send(`Upstream error: ${upstream.status}`);
    }

    const contentType =
      upstream.headers.get('content-type') || '';

    /*
     * A playlist can sometimes have an incorrect content-type.
     * Therefore detect HLS using BOTH the URL and content-type.
     */

    const isManifest =
      targetString.includes('.m3u8') ||
      contentType.toLowerCase().includes('mpegurl') ||
      contentType.toLowerCase().includes('vnd.apple.mpegurl');

    /*
     * ========================================================
     * HLS MANIFEST
     * ========================================================
     */

    if (isManifest) {
      const text = await upstream.text();

      if (!text.trim().startsWith('#EXTM3U')) {
        console.warn(
          `Invalid HLS playlist returned by ${targetUrl.href}`
        );

        return res
          .status(502)
          .send('Upstream returned invalid HLS playlist');
      }

      /*
       * The URL of the playlist is important because:
       *
       *   child.m3u8
       *   segment001.ts
       *   key.key
       *
       * are often relative URLs.
       */

      const base = new URL(targetUrl.href);

      const proxyUrl = (absoluteUrl) => {
        return `/api/proxy?url=${encodeURIComponent(
          absoluteUrl
        )}`;
      };

      const rewritten = text
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();

          if (!trimmed) {
            return line;
          }

          /*
           * --------------------------------------------------
           * HLS TAGS
           * --------------------------------------------------
           *
           * Examples:
           *
           * #EXT-X-KEY:METHOD=AES-128,URI="key.key"
           * #EXT-X-MAP:URI="init.mp4"
           * #EXT-X-MEDIA:URI="audio.m3u8"
           */

          if (trimmed.startsWith('#')) {
            /*
             * Replace every URI="..." attribute.
             */

            return trimmed.replace(
              /URI="([^"]+)"/gi,
              (match, uri) => {
                try {
                  const absolute = new URL(
                    uri,
                    base
                  ).href;

                  return `URI="${proxyUrl(
                    absolute
                  )}"`;
                } catch {
                  return match;
                }
              }
            );
          }

          /*
           * --------------------------------------------------
           * HLS PLAYLIST / SEGMENT
           * --------------------------------------------------
           *
           * This can be:
           *
           *   child.m3u8
           *   segment.ts
           *   segment.m4s
           *   audio.aac
           *   https://...
           */

          try {
            const absolute = new URL(
              trimmed,
              base
            ).href;

            return proxyUrl(absolute);
          } catch {
            return line;
          }
        })
        .join('\n');

      /*
       * ------------------------------------------------------
       * MANIFEST RESPONSE HEADERS
       * ------------------------------------------------------
       */

      res.status(200);

      res.set({
        'Content-Type':
          'application/vnd.apple.mpegurl',

        'Access-Control-Allow-Origin':
          '*',

        'Access-Control-Allow-Headers':
          '*',

        'Access-Control-Allow-Methods':
          'GET, HEAD, OPTIONS',

        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',

        Pragma:
          'no-cache',

        Expires:
          '0',

        'X-Content-Type-Options':
          'nosniff',
      });

      return res.send(rewritten);
    }

    /*
     * ========================================================
     * NON-MANIFEST MEDIA
     * ========================================================
     *
     * This handles:
     *
     * - .ts
     * - .aac
     * - .m4s
     * - .mp4
     * - .webm
     * - audio streams
     * - HLS encryption keys
     * - other binary media
     */

    const responseContentType =
      contentType ||
      'application/octet-stream';

    res.status(200);

    res.set({
      'Content-Type':
        responseContentType,

      'Access-Control-Allow-Origin':
        '*',

      'Access-Control-Allow-Headers':
        '*',

      'Access-Control-Allow-Methods':
        'GET, HEAD, OPTIONS',

      'X-Content-Type-Options':
        'nosniff',
    });

    /*
     * Do not aggressively cache live-stream segments.
     *
     * Short caching can actually cause stale HLS segments
     * and playback freezes.
     */

    if (
      targetString.includes('.ts') ||
      targetString.includes('.aac') ||
      targetString.includes('.m4s') ||
      targetString.includes('.mp4')
    ) {
      res.set(
        'Cache-Control',
        'public, max-age=5, stale-while-revalidate=10'
      );
    } else {
      res.set(
        'Cache-Control',
        'no-store'
      );
    }

    /*
     * --------------------------------------------------------
     * STREAM THE RESPONSE
     * --------------------------------------------------------
     *
     * Do NOT use:
     *
     *   await upstream.arrayBuffer()
     *
     * for live media.
     *
     * That forces the server to download the ENTIRE response
     * before sending anything to the browser.
     *
     * Streaming the upstream body gives Video.js data as soon
     * as it arrives.
     */

    if (upstream.body) {
      const reader =
        upstream.body.getReader();

      try {
        while (true) {
          const {
            done,
            value,
          } = await reader.read();

          if (done) {
            break;
          }

          if (value) {
            res.write(
              Buffer.from(value)
            );
          }
        }

        return res.end();
      } catch (streamError) {
        console.error(
          'Proxy stream error:',
          streamError.message
        );

        if (!res.headersSent) {
          return res
            .status(502)
            .send('Proxy stream failed');
        }

        return res.end();
      }
    }

    /*
     * Fallback for environments where response.body
     * isn't available.
     */

    const buffer =
      Buffer.from(
        await upstream.arrayBuffer()
      );

    return res.send(buffer);

  } catch (error) {
    if (
      error.name === 'AbortError'
    ) {
      console.error(
        `Proxy timeout: ${targetUrl.href}`
      );

      return res
        .status(504)
        .send(
          'Upstream stream timed out'
        );
    }

    console.error(
      'Proxy error:',
      error.message
    );

    if (!res.headersSent) {
      return res
        .status(502)
        .send(
          'Proxy fetch failed'
        );
    }

    return res.end();
  }
});

// ============================================================
// STREAM PROXY CORS / PREFLIGHT
// ============================================================

app.options('/api/proxy', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods':
      'GET, HEAD, OPTIONS',
  });

  return res.sendStatus(204);
});

// ============================================================
// FRONTEND CATCH-ALL
// ============================================================
// Any GET request that didn't match an API route, an SEO
// route, or a static asset above falls through to here and
// gets the React app's index.html. This is what makes "/"
// (and client-side routes like "/watch/some-channel") work.
// Must be registered AFTER every other route.

app.get('*', (req, res) => {
  const indexPath = path.join(
    __dirname,
    '..',
    STATIC_DIR,
    'index.html'
  );

  return res.sendFile(indexPath, (error) => {
    if (error) {
      console.error(
        'Failed to send index.html:',
        error.message
      );

      if (!res.headersSent) {
        res.status(500).send(
          'Unable to load application'
        );
      }
    }
  });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Static directory: ${path.join(__dirname, '..', STATIC_DIR)}`);
  console.log(
    `Country SEO pages: ${Object.keys(COUNTRY_SLUGS).length}`
  );

  // Load channels in the background.
  // Do not prevent the HTTP server from starting.
  loadChannels().catch((error) => {
    console.error(
      'Initial channel loading failed:',
      error.message
    );
  });
});
