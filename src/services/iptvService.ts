import { Channel } from '../types/channel.types';

const CACHE_KEY = 'iptv_channels';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

export const fetchIPTVChannels = async (): Promise<Channel[]> => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (data?.length && Date.now() - timestamp < CACHE_DURATION) {
          console.log(`✅ Using cached channels: ${data.length}`);
          return data;
        }
      } catch {
        localStorage.removeItem(CACHE_KEY);
      }
    }

    console.log('📡 Fetching channels from backend...');
    const res = await fetch('/api/channels');
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const { channels } = await res.json();

    if (channels?.length) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: channels, timestamp: Date.now() }));
      } catch (e) {
        console.warn('⚠️ Could not cache channels (quota?):', e);
      }
    }
    console.log(`📊 Loaded ${channels?.length || 0} channels`);
    return channels || [];
  } catch (error) {
    console.error('❌ Error fetching channels:', error);
    return [];
  }
};

export const forceRefreshChannels = async (): Promise<Channel[]> => {
  localStorage.removeItem(CACHE_KEY);
  const res = await fetch('/api/refresh');
  const { channels } = await res.json();
  if (channels?.length) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: channels, timestamp: Date.now() }));
  }
  return channels || [];
};

export const getIPTVChannelsByCountry = (channels: Channel[], country: string): Channel[] => {
  if (country === 'All') return channels;
  return channels.filter(ch => ch.country.toLowerCase() === country.toLowerCase());
};

export const getAvailableCountries = (channels: Channel[]): string[] => {
  if (!channels?.length) return ['All'];
  return ['All', ...Array.from(new Set(channels.map(ch => ch.country)))].sort();
};

export const getTotalChannels = (channels: Channel[]): number => channels.length;

export const getChannelsByCategory = (channels: Channel[], category: string): Channel[] => {
  if (category === 'All') return channels;
  return channels.filter(ch => ch.category === category);
};

// ─────────────────────────────────────────────────────────────────────────
// iptv-org integration — legal-only filtering
//
// iptv-org's own project rules require submissions to be publicly
// accessible FTA (free-to-air) streams, and they maintain a reactive
// blocklist.json of channels that received a DMCA / rights-holder removal
// request. We treat that blocklist as ground truth and exclude anything on
// it, plus anything flagged NSFW or already closed/defunct.
//
// This is a best-effort filter, not a legal guarantee — the blocklist is
// reactive (a channel can be added illegitimately and not get flagged for
// a while), so we refresh it daily rather than caching it as long as our
// own backend list.
// ─────────────────────────────────────────────────────────────────────────

const IPTV_ORG_CHANNELS_URL = 'https://iptv-org.github.io/api/channels.json';
const IPTV_ORG_STREAMS_URL = 'https://iptv-org.github.io/api/streams.json';
const IPTV_ORG_BLOCKLIST_URL = 'https://iptv-org.github.io/api/blocklist.json';

const IPTV_ORG_CACHE_KEY = 'iptv_org_legal_channels';
const IPTV_ORG_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24h — blocklist changes daily

interface IptvOrgChannel {
  id: string;
  name: string;
  country: string;
  categories: string[];
  languages?: string[];
  logo?: string;
  is_nsfw: boolean;
  closed?: string | null;
}

interface IptvOrgStream {
  channel: string;
  url: string;
}

interface IptvOrgBlocklistEntry {
  channel: string;
  reason: string; // "dmca" | "nsfw"
  ref: string;
}

const capitalize = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/**
 * Fetches the iptv-org channel/stream/blocklist datasets and returns only
 * the channels considered "legal" by that project's own moderation signal:
 *  - not flagged NSFW
 *  - not marked as closed/defunct
 *  - NOT present in the blocklist (i.e. no DMCA/removal request on file)
 *  - has a known stream URL
 */
export const fetchLegalIptvOrgChannels = async (): Promise<Channel[]> => {
  try {
    const cached = localStorage.getItem(IPTV_ORG_CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (data?.length && Date.now() - timestamp < IPTV_ORG_CACHE_DURATION) {
          console.log(`✅ Using cached iptv-org channels: ${data.length}`);
          return data;
        }
      } catch {
        localStorage.removeItem(IPTV_ORG_CACHE_KEY);
      }
    }

    console.log('📡 Fetching iptv-org channels/streams/blocklist...');
    const [channelsRes, streamsRes, blocklistRes] = await Promise.all([
      fetch(IPTV_ORG_CHANNELS_URL),
      fetch(IPTV_ORG_STREAMS_URL),
      fetch(IPTV_ORG_BLOCKLIST_URL),
    ]);

    if (!channelsRes.ok || !streamsRes.ok || !blocklistRes.ok) {
      throw new Error('One or more iptv-org endpoints failed to respond');
    }

    const [channels, streams, blocklist]: [
      IptvOrgChannel[],
      IptvOrgStream[],
      IptvOrgBlocklistEntry[]
    ] = await Promise.all([channelsRes.json(), streamsRes.json(), blocklistRes.json()]);

    const blockedIds = new Set(blocklist.map(b => b.channel));

    // Keep the first known stream URL per channel id.
    const streamByChannelId = new Map<string, string>();
    for (const s of streams) {
      if (!streamByChannelId.has(s.channel)) {
        streamByChannelId.set(s.channel, s.url);
      }
    }

    const legalChannels: Channel[] = [];
    for (const ch of channels) {
      if (ch.is_nsfw) continue;              // adult content
      if (ch.closed) continue;               // no longer broadcasting
      if (blockedIds.has(ch.id)) continue;   // DMCA / removal request on file

      const streamUrl = streamByChannelId.get(ch.id);
      if (!streamUrl) continue;              // nothing playable

      legalChannels.push({
        id: `iptvorg-${ch.id}`,
        name: ch.name,
        country: ch.country,
        category: ch.categories?.[0] ? capitalize(ch.categories[0]) : 'General',
        logo: ch.logo || '',
        language: ch.languages?.[0] || '',
        streamUrl,
      });
    }

    console.log(
      `📊 iptv-org: ${legalChannels.length} legal channels kept out of ${channels.length} total ` +
      `(${blockedIds.size} blocklisted)`
    );

    try {
      localStorage.setItem(
        IPTV_ORG_CACHE_KEY,
        JSON.stringify({ data: legalChannels, timestamp: Date.now() })
      );
    } catch (e) {
      console.warn('⚠️ Could not cache iptv-org channels (quota?):', e);
    }

    return legalChannels;
  } catch (error) {
    console.error('❌ Error fetching iptv-org channels:', error);
    return [];
  }
};