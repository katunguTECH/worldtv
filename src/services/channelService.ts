import { Channel } from '../types/channel.types';
import { fetchIPTVChannels, getIPTVChannelsByCountry } from './iptvService';

let cachedChannels: Channel[] = [];
let countries: string[] = [];
let categories: string[] = [];

// Initialize channels - call this once when app starts
export const initializeChannels = async (): Promise<void> => {
  try {
    console.log('Initializing channels...');
    cachedChannels = await fetchIPTVChannels();
    
    // Update countries list
    const countrySet = new Set(cachedChannels.map(ch => ch.country));
    countries = ['All', ...Array.from(countrySet)].sort();
    
    // Update categories list
    const categorySet = new Set(cachedChannels.map(ch => ch.category));
    categories = ['All', ...Array.from(categorySet)].sort();
    
    console.log(`Channels initialized: ${cachedChannels.length} channels, ${countries.length - 1} countries, ${categories.length - 1} categories`);
  } catch (error) {
    console.error('Error initializing channels:', error);
    cachedChannels = [];
    countries = ['All'];
    categories = ['All'];
  }
};

// Get all channels
export const getAllChannels = (): Channel[] => {
  return cachedChannels;
};

// Get unique countries
export const getCountries = (): string[] => {
  return countries;
};

// Get unique categories
export const getCategories = (): string[] => {
  return categories;
};

// Get channels by country
export const getChannelsByCountry = (country: string): Channel[] => {
  if (country === 'All') return cachedChannels;
  return getIPTVChannelsByCountry(cachedChannels, country);
};

// Search channels by name, country, or category
export const searchChannels = (query: string): Channel[] => {
  if (!query.trim()) return cachedChannels;
  const lowerQuery = query.toLowerCase().trim();
  return cachedChannels.filter(ch => 
    ch.name.toLowerCase().includes(lowerQuery) ||
    ch.country.toLowerCase().includes(lowerQuery) ||
    ch.category.toLowerCase().includes(lowerQuery) ||
    ch.language.toLowerCase().includes(lowerQuery)
  );
};

// Get channel by ID
export const getChannelById = (id: string): Channel | undefined => {
  return cachedChannels.find(ch => ch.id === id);
};

// Get channels by category
export const getChannelsByCategory = (category: string): Channel[] => {
  if (category === 'All') return cachedChannels;
  return cachedChannels.filter(ch => ch.category === category);
};

// Get channels by language
export const getChannelsByLanguage = (language: string): Channel[] => {
  if (language === 'All') return cachedChannels;
  return cachedChannels.filter(ch => ch.language === language);
};

// Get all unique languages
export const getLanguages = (): string[] => {
  const languageSet = new Set(cachedChannels.map(ch => ch.language));
  return ['All', ...Array.from(languageSet)].sort();
};

// Get a random channel
export const getRandomChannel = (): Channel | undefined => {
  if (cachedChannels.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * cachedChannels.length);
  return cachedChannels[randomIndex];
};

// Get channel count
export const getChannelCount = (): number => {
  return cachedChannels.length;
};

// Get country count
export const getCountryCount = (): number => {
  return countries.length - 1; // Exclude 'All'
};

// Get category count
export const getCategoryCount = (): number => {
  return categories.length - 1; // Exclude 'All'
};

// Check if channels are loaded
export const isChannelsLoaded = (): boolean => {
  return cachedChannels.length > 0;
};

// Refresh channels (force update)
export const refreshChannels = async (): Promise<void> => {
  console.log('Refreshing channels...');
  // Clear cache
  localStorage.removeItem('iptv_channels');
  // Re-initialize
  await initializeChannels();
};

// Get channels with pagination
export const getPaginatedChannels = (
  page: number = 1,
  pageSize: number = 50,
  country: string = 'All',
  category: string = 'All'
): { channels: Channel[]; total: number } => {
  let filtered = cachedChannels;
  
  if (country !== 'All') {
    filtered = filtered.filter(ch => ch.country === country);
  }
  
  if (category !== 'All') {
    filtered = filtered.filter(ch => ch.category === category);
  }
  
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  
  return {
    channels: filtered.slice(start, end),
    total: total
  };
};

// Get sample channels (for testing or when IPTV fails)
export const getSampleChannels = (): Channel[] => {
  return [
    {
      id: 'sample-1',
      name: 'NASA TV',
      country: 'USA',
      category: 'Education',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/1200px-NASA_logo.svg.png',
      streamUrl: 'https://nasa-i.akamaihd.net/hls/live/253871/NASA-TV/public_1200.m3u8',
      language: 'English',
    },
    {
      id: 'sample-2',
      name: 'CNN International',
      country: 'USA',
      category: 'News',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN_International_logo.svg/1200px-CNN_International_logo.svg.png',
      streamUrl: 'https://www.cnn.com/stream',
      language: 'English',
    },
    {
      id: 'sample-3',
      name: 'BBC World News',
      country: 'UK',
      category: 'News',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/BBC_World_News_2022.svg/1200px-BBC_World_News_2022.svg.png',
      streamUrl: 'https://www.bbc.com/news/live',
      language: 'English',
    },
    {
      id: 'sample-4',
      name: 'France 24',
      country: 'France',
      category: 'News',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/France_24_Logo.svg/1200px-France_24_Logo.svg.png',
      streamUrl: 'https://www.france24.com/en/live',
      language: 'French',
    },
    {
      id: 'sample-5',
      name: 'DW News',
      country: 'Germany',
      category: 'News',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Deutsche_Welle_logo.svg/1200px-Deutsche_Welle_logo.svg.png',
      streamUrl: 'https://www.dw.com/en/live-tv',
      language: 'German',
    },
  ];
};

// Get channels by country (with caching)
export const getChannelsByCountryCached = (country: string): Channel[] => {
  const cacheKey = `channels_${country}`;
  const cached = sessionStorage.getItem(cacheKey);
  
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // If cached data is corrupted, return fresh data
    }
  }
  
  const result = getChannelsByCountry(country);
  sessionStorage.setItem(cacheKey, JSON.stringify(result));
  return result;
};

// Clear cache for a specific country
export const clearCountryCache = (country: string): void => {
  sessionStorage.removeItem(`channels_${country}`);
};

// Clear all caches
export const clearAllCache = (): void => {
  sessionStorage.clear();
};