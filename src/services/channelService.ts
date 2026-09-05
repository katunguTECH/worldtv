import { Channel } from '../types/channel.types';
import { fetchIPTVChannels, forceRefreshChannels, fetchLegalIptvOrgChannels } from './iptvService';

let allChannels: Channel[] = [];
let countryIndex: Map<string, Channel[]> = new Map();
let searchIndex: { channel: Channel; haystack: string }[] = [];
let countries: string[] = ['All'];
let categories: string[] = ['All'];

function buildIndexes(channels: Channel[]) {
  allChannels = channels;
  countryIndex = new Map();
  searchIndex = [];
  const countrySet = new Set<string>();
  const categorySet = new Set<string>();

  for (const ch of channels) {
    countrySet.add(ch.country);
    categorySet.add(ch.category);

    if (!countryIndex.has(ch.country)) countryIndex.set(ch.country, []);
    countryIndex.get(ch.country)!.push(ch);

    searchIndex.push({
      channel: ch,
      haystack: `${ch.name} ${ch.country} ${ch.category}`.toLowerCase(),
    });
  }

  countries = ['All', ...Array.from(countrySet).sort()];
  categories = ['All', ...Array.from(categorySet).sort()];
}

// Dedupe iptv-org channels against our own backend list by name+country,
// so a channel we already carry (possibly from a licensed source) isn't
// duplicated by a same-named entry from the iptv-org list.
function mergeChannels(primary: Channel[], supplemental: Channel[]): Channel[] {
  const seen = new Set(primary.map(c => `${c.name}|${c.country}`.toLowerCase()));
  const extra = supplemental.filter(c => !seen.has(`${c.name}|${c.country}`.toLowerCase()));
  return [...primary, ...extra];
}

export const initializeChannels = async (): Promise<void> => {
  const [backendChannels, iptvOrgChannels] = await Promise.all([
    fetchIPTVChannels(),
    fetchLegalIptvOrgChannels(),
  ]);
  buildIndexes(mergeChannels(backendChannels, iptvOrgChannels));
};

export const refreshChannels = async (): Promise<void> => {
  const [backendChannels, iptvOrgChannels] = await Promise.all([
    forceRefreshChannels(),
    fetchLegalIptvOrgChannels(),
  ]);
  buildIndexes(mergeChannels(backendChannels, iptvOrgChannels));
};

export const getCountries = (): string[] => countries;
export const getCategories = (): string[] => categories;

export const getChannelsByCountry = (country: string): Channel[] => {
  if (country === 'All') return allChannels;
  return countryIndex.get(country) || [];
};

// Capped at 500 results — beyond that nobody's scrolling anyway, and it
// keeps the render fast even on a broad, low-specificity query.
export const searchChannels = (query: string): Channel[] => {
  const q = query.trim().toLowerCase();
  if (!q) return allChannels;
  const results: Channel[] = [];
  for (const entry of searchIndex) {
    if (entry.haystack.includes(q)) {
      results.push(entry.channel);
      if (results.length >= 500) break;
    }
  }
  return results;
};