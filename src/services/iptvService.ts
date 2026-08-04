import { Channel } from '../types/channel.types';

// Cache the channels in localStorage
const CACHE_KEY = 'iptv_channels';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// ===== COMPLETE YOUTUBE CHANNELS LIST (25+ channels) =====
const youtubeChannels: Channel[] = [
  // USA
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
    name: 'NBC News Now',
    country: 'USA',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/NBC_News_Logo_2023.svg/1200px-NBC_News_Logo_2023.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=6TLOmC9gqE8',
    language: 'English',
  },
  {
    id: 'yt-5',
    name: 'Fox Weather',
    country: 'USA',
    category: 'Weather',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Fox_Weather_logo_2021.svg/1200px-Fox_Weather_logo_2021.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=OhyGfOmC7po',
    language: 'English',
  },
  {
    id: 'yt-6',
    name: 'PBS NewsHour',
    country: 'USA',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/PBS_logo.svg/1200px-PBS_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=51S4IH42lGw',
    language: 'English',
  },
  // UK
  {
    id: 'yt-7',
    name: 'Sky News',
    country: 'UK',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Sky_News_logo_2024.svg/1200px-Sky_News_logo_2024.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=YjJ3tFDhKl8',
    language: 'English',
  },
  {
    id: 'yt-8',
    name: 'BBC News',
    country: 'UK',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/BBC_World_News_2022.svg/1200px-BBC_World_News_2022.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=5wHZz9gC_kM',
    language: 'English',
  },
  // Germany
  {
    id: 'yt-9',
    name: 'DW News',
    country: 'Germany',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Deutsche_Welle_logo.svg/1200px-Deutsche_Welle_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=s7Rl2hPx9CY',
    language: 'German',
  },
  // France
  {
    id: 'yt-10',
    name: 'France 24',
    country: 'France',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/France_24_Logo.svg/1200px-France_24_Logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=dYPg3w3QwRk',
    language: 'French',
  },
  // Qatar
  {
    id: 'yt-11',
    name: 'Al Jazeera',
    country: 'Qatar',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Al_Jazeera_2022.svg/1200px-Al_Jazeera_2022.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=YgWcR0mZTx0',
    language: 'English',
  },
  // Japan
  {
    id: 'yt-12',
    name: 'NHK World',
    country: 'Japan',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/NHK_World_logo.svg/1200px-NHK_World_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=Y7G1hByHdK0',
    language: 'Japanese',
  },
  // China
  {
    id: 'yt-13',
    name: 'CGTN',
    country: 'China',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/CCTV-News_logo.svg/1200px-CCTV-News_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=5ifuJvWz8TI',
    language: 'Chinese',
  },
  // Italy
  {
    id: 'yt-14',
    name: 'Rai News',
    country: 'Italy',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Rai_News_24_logo.svg/1200px-Rai_News_24_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=7kIZcQsmxYY',
    language: 'Italian',
  },
  // Spain
  {
    id: 'yt-15',
    name: 'RTVE Noticias',
    country: 'Spain',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/RTVE_logo.svg/1200px-RTVE_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=K5VjE5QxM8I',
    language: 'Spanish',
  },
  // Brazil
  {
    id: 'yt-16',
    name: 'Globo News',
    country: 'Brazil',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Globo_News_logo.svg/1200px-Globo_News_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=5w9xHjMZk9E',
    language: 'Portuguese',
  },
  // Russia
  {
    id: 'yt-17',
    name: 'RT News',
    country: 'Russia',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/RT_logo.svg/1200px-RT_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=UXZqXh8HZ2M',
    language: 'Russian',
  },
  // India
  {
    id: 'yt-18',
    name: 'NDTV 24x7',
    country: 'India',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/NDTV_logo.svg/1200px-NDTV_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=2wMpbwJ7koY',
    language: 'Hindi',
  },
  // Australia
  {
    id: 'yt-19',
    name: 'ABC News Australia',
    country: 'Australia',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Australian_Broadcasting_Corporation_logo.svg/1200px-Australian_Broadcasting_Corporation_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=GXb4N5c0X2Q',
    language: 'English',
  },
  // Canada
  {
    id: 'yt-20',
    name: 'CBC News',
    country: 'Canada',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/CBC_News_logo_2020.svg/1200px-CBC_News_logo_2020.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=Z0RgI3Ai_CI',
    language: 'English',
  },
  // South Africa
  {
    id: 'yt-21',
    name: 'eNCA',
    country: 'South Africa',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/eNCA_logo.svg/1200px-eNCA_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=ZqTEj9yyB7Y',
    language: 'English',
  },
  // Turkey
  {
    id: 'yt-22',
    name: 'TRT World',
    country: 'Turkey',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/TRT_World_logo.svg/1200px-TRT_World_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=5YejbGx6WxE',
    language: 'Turkish',
  },
  // South Korea
  {
    id: 'yt-23',
    name: 'Arirang TV',
    country: 'South Korea',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Arirang_TV_logo.svg/1200px-Arirang_TV_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=HXgyr9W3C4M',
    language: 'Korean',
  },
  // Israel
  {
    id: 'yt-24',
    name: 'i24 News',
    country: 'Israel',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/I24NEWS_Logo.svg/1200px-I24NEWS_Logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=8GCL2JbR-6E',
    language: 'English',
  },
  // UAE
  {
    id: 'yt-25',
    name: 'Al Arabiya',
    country: 'UAE',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Al_Arabiya_logo.svg/1200px-Al_Arabiya_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=q-1h_ug0Xwg',
    language: 'Arabic',
  },
];

// ===== HARD-CODED IPTV CHANNELS (Working streams) =====
const iptvChannels: Channel[] = [
  // USA
  {
    id: 'iptv-1',
    name: 'NASA TV (HD)',
    country: 'USA',
    category: 'Education',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/1200px-NASA_logo.svg.png',
    streamUrl: 'https://nasa-i.akamaihd.net/hls/live/253871/NASA-TV/public_1200.m3u8',
    language: 'English',
  },
  {
    id: 'iptv-2',
    name: 'Bloomberg TV',
    country: 'USA',
    category: 'Business',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Bloomberg_TV_logo.svg/1200px-Bloomberg_TV_logo.svg.png',
    streamUrl: 'https://cdn.jwplayer.com/manifests/7aZdhChM.m3u8',
    language: 'English',
  },
  {
    id: 'iptv-3',
    name: 'CBS News (Live)',
    country: 'USA',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/CBS_News_logo_2021.svg/1200px-CBS_News_logo_2021.svg.png',
    streamUrl: 'https://cbsnewshd-lh.akamaihd.net/i/CBSNHD_7@199302/master.m3u8',
    language: 'English',
  },
  // UK
  {
    id: 'iptv-4',
    name: 'Sky News (Live)',
    country: 'UK',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Sky_News_logo_2024.svg/1200px-Sky_News_logo_2024.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=YjJ3tFDhKl8', // Fixed: using YouTube URL
    language: 'English',
  },
  // France
  {
    id: 'iptv-5',
    name: 'France 24 (Live)',
    country: 'France',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/France_24_Logo.svg/1200px-France_24_Logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=dYPg3w3QwRk',
    language: 'French',
  },
  // Germany
  {
    id: 'iptv-6',
    name: 'DW TV',
    country: 'Germany',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Deutsche_Welle_logo.svg/1200px-Deutsche_Welle_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=s7Rl2hPx9CY',
    language: 'German',
  },
  // Japan
  {
    id: 'iptv-7',
    name: 'NHK World (Live)',
    country: 'Japan',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/NHK_World_logo.svg/1200px-NHK_World_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=Y7G1hByHdK0',
    language: 'Japanese',
  },
  // Qatar
  {
    id: 'iptv-8',
    name: 'Al Jazeera (Live)',
    country: 'Qatar',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Al_Jazeera_2022.svg/1200px-Al_Jazeera_2022.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=YgWcR0mZTx0',
    language: 'English',
  },
];

// ===== COMPLETE COUNTRY SOURCES FOR IPTV FETCH =====
const COUNTRY_SOURCES = [
  // North America
  { code: 'us', name: 'USA' },
  { code: 'ca', name: 'Canada' },
  { code: 'mx', name: 'Mexico' },
  // Europe
  { code: 'gb', name: 'UK' },
  { code: 'fr', name: 'France' },
  { code: 'de', name: 'Germany' },
  { code: 'it', name: 'Italy' },
  { code: 'es', name: 'Spain' },
  { code: 'ru', name: 'Russia' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'se', name: 'Sweden' },
  { code: 'no', name: 'Norway' },
  { code: 'dk', name: 'Denmark' },
  { code: 'fi', name: 'Finland' },
  { code: 'pl', name: 'Poland' },
  { code: 'tr', name: 'Turkey' },
  { code: 'pt', name: 'Portugal' },
  { code: 'gr', name: 'Greece' },
  // Asia
  { code: 'jp', name: 'Japan' },
  { code: 'in', name: 'India' },
  { code: 'kr', name: 'South Korea' },
  { code: 'cn', name: 'China' },
  { code: 'tw', name: 'Taiwan' },
  { code: 'hk', name: 'Hong Kong' },
  { code: 'sg', name: 'Singapore' },
  { code: 'my', name: 'Malaysia' },
  { code: 'ph', name: 'Philippines' },
  { code: 'vn', name: 'Vietnam' },
  { code: 'th', name: 'Thailand' },
  { code: 'id', name: 'Indonesia' },
  { code: 'pk', name: 'Pakistan' },
  { code: 'bd', name: 'Bangladesh' },
  // Middle East
  { code: 'il', name: 'Israel' },
  { code: 'ae', name: 'UAE' },
  { code: 'sa', name: 'Saudi Arabia' },
  { code: 'eg', name: 'Egypt' },
  // Africa
  { code: 'za', name: 'South Africa' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'ke', name: 'Kenya' },
  { code: 'gh', name: 'Ghana' },
  // South America
  { code: 'br', name: 'Brazil' },
  { code: 'ar', name: 'Argentina' },
  { code: 'co', name: 'Colombia' },
  { code: 'cl', name: 'Chile' },
  { code: 'pe', name: 'Peru' },
  // Oceania
  { code: 'au', name: 'Australia' },
  { code: 'nz', name: 'New Zealand' },
];

// ===== PARSE M3U CONTENT =====
const parseM3UContent = (content: string, countryName: string): Channel[] => {
  const lines = content.split('\n');
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> = {};

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('#EXTINF:')) {
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

// ===== FETCH IPTV CHANNELS =====
export const fetchIPTVChannels = async (): Promise<Channel[]> => {
  console.log('🔄 Fetching IPTV channels...');
  
  try {
    // Check cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (data && data.length > 0 && Date.now() - timestamp < CACHE_DURATION) {
          console.log(`✅ Using cached channels: ${data.length}`);
          return data;
        }
      } catch (e) {
        console.warn('Cache parse error:', e);
        localStorage.removeItem(CACHE_KEY);
      }
    }

    console.log('📡 Fetching fresh IPTV channels from country playlists...');
    let allChannels: Channel[] = [];
    let successfulFetches = 0;

    // Try to fetch from IPTV-org for each country
    for (const source of COUNTRY_SOURCES) {
      try {
        const urls = [
          `https://raw.githubusercontent.com/iptv-org/iptv/master/playlists/${source.code}.m3u`,
          `https://cdn.jsdelivr.net/gh/iptv-org/iptv@master/playlists/${source.code}.m3u`,
        ];
        
        let fetched = false;
        for (const url of urls) {
          try {
            console.log(`📡 Fetching from: ${source.code} (${source.name})`);
            
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/plain, application/x-mpegURL, */*',
              },
            });

            if (response.ok) {
              const content = await response.text();
              if (content && content.length > 100) {
                const channels = parseM3UContent(content, source.name);
                if (channels.length > 0) {
                  allChannels = [...allChannels, ...channels];
                  successfulFetches++;
                  console.log(`✅ Added ${channels.length} channels from ${source.name}`);
                  fetched = true;
                  break;
                }
              }
            }
          } catch (e) {
            console.warn(`⚠️ Failed URL for ${source.code}:`, e);
          }
        }
        
        if (!fetched) {
          console.warn(`⚠️ Could not fetch ${source.code} from any source`);
        }
      } catch (error) {
        console.warn(`⚠️ Error fetching from ${source.code}:`, error);
      }
    }

    // If we got IPTV channels, add them
    if (allChannels.length > 0) {
      console.log(`✅ Got ${allChannels.length} IPTV channels from ${successfulFetches} countries`);
    } else {
      console.log('📡 No IPTV channels fetched, using hardcoded IPTV list');
      allChannels = [...iptvChannels];
    }

    // Add YouTube channels
    allChannels = [...allChannels, ...youtubeChannels];
    console.log(`📊 Total channels loaded: ${allChannels.length}`);

    // Cache the results
    if (allChannels.length > 0) {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data: allChannels,
          timestamp: Date.now(),
        })
      );
    }

    return allChannels;
  } catch (error) {
    console.error('❌ Error fetching IPTV channels:', error);
    // Return YouTube + hardcoded IPTV as fallback
    return [...iptvChannels, ...youtubeChannels];
  }
};

// ===== HELPER FUNCTIONS =====
export const getIPTVChannelsByCountry = (
  channels: Channel[],
  country: string
): Channel[] => {
  if (country === 'All') return channels;
  return channels.filter(ch => 
    ch.country.toLowerCase() === country.toLowerCase()
  );
};

export const getAvailableCountries = (channels: Channel[]): string[] => {
  if (!channels || channels.length === 0) {
    return ['All'];
  }
  const countrySet = new Set(channels.map(ch => ch.country));
  return ['All', ...Array.from(countrySet)].sort();
};

export const getTotalChannels = (channels: Channel[]): number => {
  return channels.length;
};

export const getChannelsByCategory = (channels: Channel[], category: string): Channel[] => {
  if (category === 'All') return channels;
  return channels.filter(ch => ch.category === category);
};

// Force refresh channels
export const forceRefreshChannels = async (): Promise<Channel[]> => {
  console.log('🔄 Force refreshing channels...');
  localStorage.removeItem(CACHE_KEY);
  return await fetchIPTVChannels();
};