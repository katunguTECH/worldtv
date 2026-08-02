import { Channel } from '../types/channel.types';

// Cache the channels in localStorage
const CACHE_KEY = 'iptv_channels';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// YouTube live streams to add
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
  {
    id: 'yt-6',
    name: 'France 24',
    country: 'France',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/France_24_Logo.svg/1200px-France_24_Logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=dYPg3w3QwRk',
    language: 'French',
  },
  {
    id: 'yt-7',
    name: 'Al Jazeera',
    country: 'Qatar',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Al_Jazeera_2022.svg/1200px-Al_Jazeera_2022.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=YgWcR0mZTx0',
    language: 'English',
  },
  {
    id: 'yt-8',
    name: 'NHK World',
    country: 'Japan',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/NHK_World_logo.svg/1200px-NHK_World_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=Y7G1hByHdK0',
    language: 'Japanese',
  },
  {
    id: 'yt-9',
    name: 'CGTN',
    country: 'China',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/CCTV-News_logo.svg/1200px-CCTV-News_logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=5ifuJvWz8TI',
    language: 'Chinese',
  },
  {
    id: 'yt-10',
    name: 'Euronews',
    country: 'France',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Euronews_Logo.svg/1200px-Euronews_Logo.svg.png',
    streamUrl: 'https://www.youtube.com/watch?v=Rg72LSuYzRg',
    language: 'French',
  },
];

// Parse M3U content from IPTV-org
const parseM3UContent = (content: string): Channel[] => {
  const lines = content.split('\n');
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> = {};
  let currentUrl = '';

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
        country: groupMatch ? groupMatch[1] : 'Various',
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

// Fetch channels from IPTV-org
export const fetchIPTVChannels = async (): Promise<Channel[]> => {
  try {
    // Check cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        console.log('Using cached IPTV channels:', data.length);
        return data;
      }
    }

    console.log('Fetching fresh IPTV channels...');
    const response = await fetch(
      'https://raw.githubusercontent.com/iptv-org/iptv/master/playlists/iptv.m3u',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const content = await response.text();
    const channels = parseM3UContent(content);

    // Add YouTube channels
    const allChannels = [...channels, ...youtubeChannels];

    // Cache the results
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data: allChannels,
        timestamp: Date.now(),
      })
    );

    console.log('Loaded channels:', allChannels.length);
    return allChannels;
  } catch (error) {
    console.error('Error fetching IPTV channels:', error);
    
    // Return YouTube channels as fallback
    console.log('Using YouTube channels as fallback');
    return youtubeChannels;
  }
};

// Get channels with pagination support
export const getPaginatedChannels = (
  channels: Channel[],
  page: number = 1,
  pageSize: number = 50
): Channel[] => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return channels.slice(start, end);
};

// Get channels by country from IPTV list
export const getIPTVChannelsByCountry = (
  channels: Channel[],
  country: string
): Channel[] => {
  if (country === 'All') return channels;
  return channels.filter(ch => 
    ch.country.toLowerCase() === country.toLowerCase() ||
    ch.country.includes(country)
  );
};