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