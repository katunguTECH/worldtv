// ============================================================
// STREAM HEALTH CHECK
// ============================================================
// Probes a channel's stream URL with ffprobe and reports whether
// it is actually watchable: reachable within a timeout, AND
// carrying a video track (not just audio, which is the common
// "dead" failure mode for scraped IPTV links — the server
// answers, but only an audio/metadata track comes through).
//
// Uses @ffprobe-installer/ffprobe so a working ffprobe binary is
// guaranteed on any platform (Render, Railway, etc.) without
// depending on a system package being present.
// ============================================================

const { spawn, spawnSync } = require('child_process');

// ------------------------------------------------------------
// Resolve which ffprobe binary to use, in order of preference:
//   1. FFPROBE_PATH env var, if set (explicit override)
//   2. A system `ffprobe` on PATH (e.g. `apt-get install ffmpeg`) —
//      preferred when present, since it's a standard build
//   3. The bundled @ffprobe-installer/ffprobe binary, as a
//      portable fallback for hosts with no system ffmpeg
// If none work, health checks are disabled (fail-open: every
// channel is treated as healthy) rather than wiping the channel
// list because of a broken/missing binary.
// ------------------------------------------------------------
function resolveFfprobePath() {
  if (process.env.FFPROBE_PATH) {
    return process.env.FFPROBE_PATH;
  }

  try {
    const check = spawnSync('ffprobe', ['-version']);
    if (!check.error && check.status === 0) {
      return 'ffprobe';
    }
  } catch {
    // fall through to bundled binary
  }

  try {
    return require('@ffprobe-installer/ffprobe').path;
  } catch {
    return null;
  }
}

const ffprobePath = resolveFfprobePath();

if (!ffprobePath) {
  console.warn(
    '⚠️  No working ffprobe binary found (checked FFPROBE_PATH, system PATH, ' +
    'and @ffprobe-installer/ffprobe). Install ffmpeg on the host, or run ' +
    '`npm install @ffprobe-installer/ffprobe` — until then, stream health ' +
    'checks are skipped and channels are assumed healthy.'
  );
} else {
  console.log(`Stream health check using ffprobe at: ${ffprobePath}`);
}

const DEFAULT_TIMEOUT_MS = 10000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

// URLs we can't/shouldn't probe with ffprobe (e.g. YouTube embed
// pages — those are HTML, not a media container). Always treated
// as healthy; their own platform handles playback failures.
function isProbeable(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('youtube.com/embed')) return false;
  return true;
}

/**
 * Probes a single stream URL. Resolves (never rejects) with:
 *   { ok: boolean, hasVideo: boolean, hasAudio: boolean, reason?: string }
 */
function probeStream(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    if (!ffprobePath) {
      resolve({ ok: true, hasVideo: true, hasAudio: true, reason: 'ffprobe unavailable, skipped' });
      return;
    }

    const args = [
      '-v', 'error',
      '-user_agent', USER_AGENT,
      // Give the demuxer a few seconds of the actual stream to look at —
      // some IPTV sources don't expose the video track's metadata in the
      // first few packets, so probing too little produces false "audio
      // only" negatives.
      '-analyzeduration', '5000000',
      '-probesize', '5000000',
      // ffprobe's -timeout is microseconds and applies to the underlying
      // I/O (connect/read), which is what actually hangs on dead links.
      '-timeout', String(timeoutMs * 1000),
      '-show_entries', 'stream=codec_type,codec_name',
      '-of', 'json',
      url,
    ];

    let stdout = '';
    let stderr = '';
    let settled = false;

    let child;
    try {
      child = spawn(ffprobePath, args);
    } catch (error) {
      resolve({ ok: false, hasVideo: false, hasAudio: false, reason: `spawn failed: ${error.message}` });
      return;
    }

    // Hard timeout in case ffprobe itself hangs despite -timeout
    // (happens with some misbehaving servers that accept the
    // connection but never send headers).
    const killTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ ok: false, hasVideo: false, hasAudio: false, reason: 'timed out' });
    }, timeoutMs + 3000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve({ ok: false, hasVideo: false, hasAudio: false, reason: `spawn error: ${error.message}` });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);

      if (code !== 0) {
        const lastLine = stderr.trim().split('\n').filter(Boolean).pop();
        resolve({
          ok: false,
          hasVideo: false,
          hasAudio: false,
          reason: lastLine || `ffprobe exited with code ${code}`,
        });
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch (error) {
        resolve({ ok: false, hasVideo: false, hasAudio: false, reason: 'unreadable ffprobe output' });
        return;
      }

      const streams = parsed.streams || [];
      const hasVideo = streams.some((s) => s.codec_type === 'video');
      const hasAudio = streams.some((s) => s.codec_type === 'audio');

      if (!hasVideo) {
        resolve({
          ok: false,
          hasVideo,
          hasAudio,
          reason: hasAudio ? 'audio-only (no video track)' : 'no playable audio/video streams',
        });
        return;
      }

      resolve({ ok: true, hasVideo, hasAudio });
    });
  });
}

/**
 * Health-checks a list of channels concurrently and returns the
 * ones that are actually playable, plus a report of what got
 * dropped and why. Channels whose streamUrl can't be probed
 * (e.g. YouTube embeds) pass through untouched.
 */
async function filterHealthyChannels(channels, options = {}) {
  const {
    concurrency = 25,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onProgress = null,
  } = options;

  const healthy = [];
  const removed = [];

  let cursor = 0;
  let checked = 0;
  const total = channels.length;

  const workerCount = Math.max(1, Math.min(concurrency, total));

  const workers = new Array(workerCount).fill(null).map(async () => {
    while (cursor < total) {
      const i = cursor++;
      const channel = channels[i];

      if (!isProbeable(channel.streamUrl)) {
        healthy.push(channel);
      } else {
        const result = await probeStream(channel.streamUrl, timeoutMs);
        if (result.ok) {
          healthy.push(channel);
        } else {
          removed.push({ channel, reason: result.reason });
        }
      }

      checked += 1;
      if (onProgress) {
        try {
          onProgress(checked, total);
        } catch {
          // never let a logging callback break the health check
        }
      }
    }
  });

  await Promise.all(workers);

  return { healthy, removed };
}

module.exports = {
  probeStream,
  filterHealthyChannels,
  isProbeable,
};
