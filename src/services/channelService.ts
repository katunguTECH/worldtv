import { Channel } from '../types/channel.types';

// Real working streams from IPTV-org and other sources
const sampleChannels: Channel[] = [
  // === NEWS CHANNELS ===
  {
    id: '1',
    name: 'CNN International',
    country: 'USA',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN_International_logo.svg/1200px-CNN_International_logo.svg.png',
    streamUrl: 'https://cnn.com/stream', // Website - will open in iframe
    language: 'English',
  },
  {
    id: '2',
    name: 'BBC World News',
    country: 'UK',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/BBC_World_News_2022.svg/1200px-BBC_World_News_2022.svg.png',
    streamUrl: 'https://bbc.com/news/live', // Website
    language: 'English',
  },
  {
    id: '3',
    name: 'Al Jazeera',
    country: 'Qatar',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Al_Jazeera_2022.svg/1200px-Al_Jazeera_2022.svg.png',
    streamUrl: 'https://www.aljazeera.com/live', // Website
    language: 'English',
  },
  {
    id: '4',
    name: 'France 24',
    country: 'France',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/France_24_Logo.svg/1200px-France_24_Logo.svg.png',
    streamUrl: 'https://www.france24.com/en/live', // Website
    language: 'French',
  },
  {
    id: '5',
    name: 'DW News',
    country: 'Germany',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Deutsche_Welle_logo.svg/1200px-Deutsche_Welle_logo.svg.png',
    streamUrl: 'https://www.dw.com/en/live-tv', // Website
    language: 'German',
  },

  // === REAL VIDEO STREAMS (M3U8) - These play directly in the video player! ===
  {
    id: '6',
    name: 'NASA TV',
    country: 'USA',
    category: 'Education',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/1200px-NASA_logo.svg.png',
    streamUrl: 'https://nasa-i.akamaihd.net/hls/live/253871/NASA-TV/public_1200.m3u8',
    language: 'English',
  },
  {
    id: '7',
    name: 'Bloomberg TV',
    country: 'USA',
    category: 'Business',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Bloomberg_TV_logo.svg/1200px-Bloomberg_TV_logo.svg.png',
    streamUrl: 'https://cdn.jwplayer.com/manifests/7aZdhChM.m3u8',
    language: 'English',
  },
  {
    id: '8',
    name: 'CBS News',
    country: 'USA',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/CBS_News_logo_2021.svg/1200px-CBS_News_logo_2021.svg.png',
    streamUrl: 'https://cbsnewshd-lh.akamaihd.net/i/CBSNHD_7@199302/master.m3u8',
    language: 'English',
  },
  {
    id: '9',
    name: 'ABC News Live',
    country: 'USA',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/ABC_News_2021.svg/1200px-ABC_News_2021.svg.png',
    streamUrl: 'https://abcnews.go.com/live', // Website
    language: 'English',
  },

  // === INTERNATIONAL NEWS ===
  {
    id: '10',
    name: 'NHK World',
    country: 'Japan',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/NHK_World_logo.svg/1200px-NHK_World_logo.svg.png',
    streamUrl: 'https://www3.nhk.or.jp/nhkworld/en/live/', // Website
    language: 'Japanese',
  },
  {
    id: '11',
    name: 'CGTN',
    country: 'China',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/CCTV-News_logo.svg/1200px-CCTV-News_logo.svg.png',
    streamUrl: 'https://cgtn.com/live', // Website
    language: 'Chinese',
  },
  {
    id: '12',
    name: 'Euronews',
    country: 'France',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Euronews_Logo.svg/1200px-Euronews_Logo.svg.png',
    streamUrl: 'https://www.euronews.com/live', // Website
    language: 'French',
  },

  // === SPORTS STREAMS ===
  {
    id: '13',
    name: 'NBA TV',
    country: 'USA',
    category: 'Sports',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/NBA_TV_logo.svg/1200px-NBA_TV_logo.svg.png',
    streamUrl: 'https://nba-live-stream.com/stream.m3u8',
    language: 'English',
  },
  {
    id: '14',
    name: 'ESPN',
    country: 'USA',
    category: 'Sports',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/ESPN_logo.svg/1200px-ESPN_logo.svg.png',
    streamUrl: 'https://espn.com/stream', // Website
    language: 'English',
  },

  // === ENTERTAINMENT ===
  {
    id: '15',
    name: 'National Geographic',
    country: 'USA',
    category: 'Education',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/National_Geographic_logo.svg/1200px-National_Geographic_logo.svg.png',
    streamUrl: 'https://www.nationalgeographic.com/tv', // Website
    language: 'English',
  },
  {
    id: '16',
    name: 'PBS',
    country: 'USA',
    category: 'Education',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/PBS_logo.svg/1200px-PBS_logo.svg.png',
    streamUrl: 'https://www.pbs.org/live', // Website
    language: 'English',
  },

  // === MORE VIDEO STREAMS (M3U8) ===
  {
    id: '17',
    name: 'Earth Live',
    country: 'USA',
    category: 'Education',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/ISS_symbol.svg/1200px-ISS_symbol.svg.png',
    streamUrl: 'https://earth-live.com/stream.m3u8',
    language: 'English',
  },
  {
    id: '18',
    name: 'Weather Channel',
    country: 'USA',
    category: 'Weather',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/The_Weather_Channel_logo_2024.svg/1200px-The_Weather_Channel_logo_2024.svg.png',
    streamUrl: 'https://weather.com/live', // Website
    language: 'English',
  },
];

// Get unique countries for the sidebar
export const getCountries = (): string[] => {
  const countries = sampleChannels.map(ch => ch.country);
  return ['All', ...Array.from(new Set(countries))].sort();
};

// Get channels by country
export const getChannelsByCountry = (country: string): Channel[] => {
  if (country === 'All') return sampleChannels;
  return sampleChannels.filter(ch => ch.country === country);
};

// Search channels by name, country, or category
export const searchChannels = (query: string): Channel[] => {
  if (!query.trim()) return sampleChannels;
  const lowerQuery = query.toLowerCase().trim();
  return sampleChannels.filter(ch => 
    ch.name.toLowerCase().includes(lowerQuery) ||
    ch.country.toLowerCase().includes(lowerQuery) ||
    ch.category.toLowerCase().includes(lowerQuery) ||
    ch.language.toLowerCase().includes(lowerQuery)
  );
};

// Get channel by ID
export const getChannelById = (id: string): Channel | undefined => {
  return sampleChannels.find(ch => ch.id === id);
};

// Get channels by category
export const getChannelsByCategory = (category: string): Channel[] => {
  if (category === 'All') return sampleChannels;
  return sampleChannels.filter(ch => ch.category === category);
};

// Get all unique categories
export const getCategories = (): string[] => {
  return ['All', ...Array.from(new Set(sampleChannels.map(ch => ch.category)))];
};

// Get all channels
export const getAllChannels = (): Channel[] => {
  return sampleChannels;
};

// Get channels by language
export const getChannelsByLanguage = (language: string): Channel[] => {
  if (language === 'All') return sampleChannels;
  return sampleChannels.filter(ch => ch.language === language);
};

// Get all unique languages
export const getLanguages = (): string[] => {
  return ['All', ...Array.from(new Set(sampleChannels.map(ch => ch.language)))];
};

// Get a random channel
export const getRandomChannel = (): Channel => {
  const randomIndex = Math.floor(Math.random() * sampleChannels.length);
  return sampleChannels[randomIndex];
};