import { Channel } from '../types/channel.types';

// Cache the channels in localStorage
const CACHE_KEY = 'iptv_channels';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// YouTube live streams as fallback
const youtubeChannels: Channel[] = [
  {
    id: 'yt-1',
    name: 'NASA Live',
    country: 'USA',
    category: 'Education',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/1200px-NASA_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=21X5lGlDOfg',
    language: 'English',
  },
  {
    id: 'yt-2',
    name: 'ABC News Live',
    country: 'USA',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/ABC_News_2021.svg/1200px-ABC_News_2021.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=w_Ma8oQLmSM',
    language: 'English',
  },
  {
    id: 'yt-3',
    name: 'CBS News 24/7',
    country: 'USA',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/CBS_News_logo_2021.svg/1200px-CBS_News_logo_2021.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=NlgB8jQ9gG0',
    language: 'English',
  },
  {
    id: 'yt-4',
    name: 'Sky News',
    country: 'UK',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Sky_News_logo_2024.svg/1200px-Sky_News_logo_2024.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=YjJ3tFDhKl8',
    language: 'English',
  },
  {
    id: 'yt-5',
    name: 'DW News',
    country: 'Germany',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Deutsche_Welle_logo.svg/1200px-Deutsche_Welle_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=s7Rl2hPx9CY',
    language: 'German',
  },
];

// List of country codes and their names
const COUNTRY_SOURCES = [
  { code: 'us', name: 'USA' },
  { code: 'gb', name: 'UK' },
  { code: 'fr', name: 'France' },
  { code: 'de', name: 'Germany' },
  { code: 'jp', name: 'Japan' },
  { code: 'in', name: 'India' },
  { code: 'br', name: 'Brazil' },
  { code: 'es', name: 'Spain' },
  { code: 'it', name: 'Italy' },
  { code: 'ru', name: 'Russia' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'mx', name: 'Mexico' },
  { code: 'kr', name: 'South Korea' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'se', name: 'Sweden' },
  { code: 'no', name: 'Norway' },
  { code: 'dk', name: 'Denmark' },
  { code: 'fi', name: 'Finland' },
  { code: 'pl', name: 'Poland' },
  { code: 'tr', name: 'Turkey' },
  { code: 'eg', name: 'Egypt' },
  { code: 'za', name: 'South Africa' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'pk', name: 'Pakistan' },
  { code: 'bd', name: 'Bangladesh' },
  { code: 'vn', name: 'Vietnam' },
  { code: 'th', name: 'Thailand' },
  { code: 'my', name: 'Malaysia' },
  { code: 'ph', name: 'Philippines' },
];

// Parse M3U content from IPTV-org
const parseM3UContent = (content: string, countryName: string): Channel[] => {
  const lines = content.split('\n');
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> = {};

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('#EXTINF:')) {
      // Parse channel metadata
      const nameMatch = trimmedLine.match(/,([^,]+)$/);
      const logoMatch = trimmedLine.match(/tvg-logo="([^"]*)"/);
      const groupMatch = trimmedLine.match(/group-title="([^"]*)"/);
      const idMatch = trimmedLine.match(/tvg-id="([^"]*)"/);
      
      currentChannel = {
        id: idMatch ? idMatch[1] : `iptv-${channels.length}`,
        name: nameMatch ? nameMatch[1].trim() : 'Unknown Channel',
        logo: logoMatch ? logoMatch[1] : 'https://via.placeholder.com/80x80?text=TV',
        country: countryName,
        category: groupMatch ? groupMatch[1] : 'General',
        language: 'Unknown',
        streamUrl: '',
      };
    } else if (trimmedLine.startsWith('http') && currentChannel.id) {
      currentChannel.streamUrl = trimmedLine;
      if (currentChannel.name && currentChannel.streamUrl) {
        channels.push(currentChannel as Channel);
      }
      currentChannel = {};
    }
  }

  return channels;
};

// Fetch channels from all country playlists
export const fetchIPTVChannels = async (): Promise<Channel[]> => {
  console.log('🔄 Fetching IPTV channels...');
  
  try {
    // Check cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (data && data.length > 0 && Date.now() - timestamp < CACHE_DURATION) {
          console.log('✅ Using cached IPTV channels:', data.length);
          return data;
        }
      } catch (e) {
        console.warn('Cache parse error:', e);
        localStorage.removeItem(CACHE_KEY);
      }
    }

    console.log('📡 Fetching fresh IPTV channels from country playlists...');
    let allChannels: Channel[] = [];
    
    // Fetch from each country source
    for (const source of COUNTRY_SOURCES) {
      try {
        const url = `https://raw.githubusercontent.com/iptv-org/iptv/master/playlists/${source.code}.m3u`;
        console.log(`📡 Fetching from: ${source.code} (${source.name})`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (response.ok) {
          const content = await response.text();
          const channels = parseM3UContent(content, source.name);
          allChannels = [...allChannels, ...channels];
          console.log(`✅ Added ${channels.length} channels from ${source.name}`);
        } else {
          console.warn(`⚠️ Failed to fetch from ${source.code}: ${response.status}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error fetching from ${source.code}:`, error);
      }
    }

    // Add YouTube channels
    allChannels = [...allChannels, ...youtubeChannels];
    console.log(`📊 Total channels loaded: ${allChannels.length}`);

    // Only cache if we got channels
    if (allChannels.length > 0) {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data: allChannels,
          timestamp: Date.now(),
        })
      );
      return allChannels;
    } else {
      console.warn('⚠️ No channels loaded, using YouTube fallback');
      return youtubeChannels;
    }
  } catch (error) {
    console.error('❌ Error fetching IPTV channels:', error);
    console.log('🎬 Using YouTube channels as fallback');
    return youtubeChannels;
  }
};

// Get channels by country from IPTV list
export const getIPTVChannelsByCountry = (
  channels: Channel[],
  country: string
): Channel[] => {
  if (country === 'All') return channels;
  return channels.filter(ch => 
    ch.country.toLowerCase() === country.toLowerCase()
  );
};

// Get available countries from loaded channels
export const getAvailableCountries = (channels: Channel[]): string[] => {
  if (!channels || channels.length === 0) {
    return ['All'];
  }
  const countrySet = new Set(channels.map(ch => ch.country));
  return ['All', ...Array.from(countrySet)].sort();
};