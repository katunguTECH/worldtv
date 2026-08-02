import { Channel } from '../types/channel.types';
import { fetchIPTVChannels, getIPTVChannelsByCountry, getAvailableCountries } from './iptvService';

let cachedChannels: Channel[] = [];
let countries: string[] = [];
let categories: string[] = [];

// Initialize channels - call this once when app starts
export const initializeChannels = async (): Promise<void> => {
  try {
    console.log('🚀 Initializing channels...');
    cachedChannels = await fetchIPTVChannels();
    
    // Update countries list
    countries = getAvailableCountries(cachedChannels);
    
    // Update categories list
    const categorySet = new Set(cachedChannels.map(ch => ch.category));
    categories = ['All', ...Array.from(categorySet)].sort();
    
    console.log(`✅ Channels initialized: ${cachedChannels.length} channels, ${countries.length - 1} countries, ${categories.length - 1} categories`);
  } catch (error) {
    console.error('❌ Error initializing channels:', error);
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

// Check if channels are loaded
export const isChannelsLoaded = (): boolean => {
  return cachedChannels.length > 0;
};

// Refresh channels (force update)
export const refreshChannels = async (): Promise<void> => {
  console.log('🔄 Refreshing channels...');
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