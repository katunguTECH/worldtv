// server/streamProxy.js
// Same-origin HLS proxy for WorldTV.
// Registered from index.js via: require('./streamProxy')(app);
//
//   1. Adds GET /api/stream?u=...&r=...&ua=...
//      -> fetches upstream with Referer/User-Agent, rewrites .m3u8 body
//         so segments also route through here.
//      -> Adds Access-Control-Allow-Origin: *
//      -> Fixes CORS, mixed-content, and Referer-gated streams.
//
//   2. Middleware that wraps channel arrays in /api/channels and
//      /api/iptv-org-channels responses: replaces each channel.streamUrl
//      with /api/stream?u=<original>... The server-side cache keeps
//      the raw URLs, so health-check and pruning still work.

function buildProxyUrl(ch) {
  if (!ch || typeof ch !== 'object' || !ch.streamUrl) return ch;
  if (String(ch.streamUrl).startsWith('/api/stream')) return ch;

  var qs =
    'u=' + encodeURIComponent(ch.streamUrl) +
    '&r=' + encodeURIComponent(ch.referrer || '') +
    '&ua=' + encodeURIComponent(ch.userAgent || '');

  return Object.assign({}, ch, { streamUrl: '/api/stream?' + qs });
}

module.exports = function registerStreamProxy(app) {
  app.get('/api/stream', async function (req, res) {
    var u = req.query.u;
    var r = req.query.r;
    var ua = req.query.ua;

    if (!u) return res.status(400).send('missing u');

    var upstream = decodeURIComponent(u);
    if (!/^https?:\/\//i.test(upstream)) {
      return res.status(400).send('bad scheme');
    }

    var headers = {
      'user-agent':
        ua ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      accept: '*/*',
    };

    if (r) {
      headers.referer = r;
      try {
        headers.origin = new URL(r).origin;
      } catch (e) {}
    }

    try {
      var up = await fetch(upstream, { headers: headers, redirect: 'follow' });

      if (!up.ok) {
        return res
          .status(up.status)
          .set('access-control-allow-origin', '*')
          .send('upstream ' + up.status);
      }

      var contentType = up.headers.get('content-type') || '';
      var looksPlaylist =
        /mpegurl|m3u/i.test(contentType) ||
        /\.m3u8?(\?|$)/i.test(upstream);

      res.set('access-control-allow-origin', '*');
      res.set('cache-control', 'no-store');

      if (looksPlaylist) {
        var text = await up.text();
        var baseUrl = new URL(upstream);

        var mk = function (x) {
          return (
            '/api/stream?u=' + encodeURIComponent(x) +
            '&r=' + encodeURIComponent(r || '') +
            '&ua=' + encodeURIComponent(ua || '')
          );
        };

        var lines = text.split(/\r?\n/);
        var out = [];
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (!line) {
            out.push(line);
            continue;
          }
          if (line.charAt(0) === '#') {
            out.push(
              line.replace(/URI="([^"]+)"/g, function (_, uri) {
                try {
                  return 'URI="' + mk(new URL(uri, baseUrl).toString()) + '"';
                } catch (e) {
                  return 'URI="' + uri + '"';
                }
              })
            );
          } else {
            try {
              out.push(mk(new URL(line.trim(), baseUrl).toString()));
            } catch (e) {
              out.push(line);
            }
          }
        }

        res.set('content-type', 'application/vnd.apple.mpegurl');
        return res.send(out.join('\n'));
      }

      res.set('content-type', contentType || 'application/octet-stream');
      return res.send(Buffer.from(await up.arrayBuffer()));
    } catch (e) {
      console.error('[proxy]', upstream, e.message);
      return res.status(502).send('upstream error');
    }
  });

  // Wrap channel arrays in JSON responses BEFORE the channel routes run.
  var wrapPaths = ['/api/channels', '/api/iptv-org-channels'];
  app.use(wrapPaths, function (req, res, next) {
    var origJson = res.json.bind(res);
    res.json = function (body) {
      if (body && Array.isArray(body.channels)) {
        body.channels = body.channels.map(buildProxyUrl);
      }
      return origJson(body);
    };
    next();
  });
};