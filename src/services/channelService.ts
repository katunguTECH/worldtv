import { Channel } from '../types/channel.types';

// Sample channels with real working streams where possible
const sampleChannels: Channel[] = [
  // USA
  {
    id: '1',
    name: 'ABC News',
    country: 'USA',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/ABC_News_2021.svg/1200px-ABC_News_2021.svg.png',
    streamUrl: 'https://abcnews.go.com/live',
    language: 'English',
  },
  {
    id: '2',
    name: 'CNN',
    country: 'USA',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN_International_logo.svg/1200px-CNN_International_logo.svg.png',
    streamUrl: 'https://www.cnn.com/stream',
    language: 'English',
  },
  // UK
  {
    id: '3',
    name: 'BBC World News',
    country: 'UK',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/BBC_World_News_2022.svg/1200px-BBC_World_News_2022.svg.png',
    streamUrl: 'https://www.bbc.com/news/live',
    language: 'English',
  },
  // Japan
  {
    id: '4',
    name: 'NHK World',
    country: 'Japan',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/NHK_World_logo.svg/1200px-NHK_World_logo.svg.png',
    streamUrl: 'https://www3.nhk.or.jp/nhkworld/en/live/',
    language: 'Japanese',
  },
  // France
  {
    id: '5',
    name: 'France 24',
    country: 'France',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/France_24_Logo.svg/1200px-France_24_Logo.svg.png',
    streamUrl: 'https://www.france24.com/en/live',
    language: 'French',
  },
  // Germany
  {
    id: '6',
    name: 'DW News',
    country: 'Germany',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Deutsche_Welle_logo.svg/1200px-Deutsche_Welle_logo.svg.png',
    streamUrl: 'https://www.dw.com/en/live-tv',
    language: 'German',
  },
  // Italy
  {
    id: '7',
    name: 'Rai News',
    country: 'Italy',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Rai_News_24_logo.svg/1200px-Rai_News_24_logo.svg.png',
    streamUrl: 'https://www.rainews.it/',
    language: 'Italian',
  },
  // Spain
  {
    id: '8',
    name: 'RTVE Noticias',
    country: 'Spain',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/RTVE_logo.svg/1200px-RTVE_logo.svg.png',
    streamUrl: 'https://www.rtve.es/noticias/directo/',
    language: 'Spanish',
  },
  // Brazil
  {
    id: '9',
    name: 'Globo News',
    country: 'Brazil',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Globo_News_logo.svg/1200px-Globo_News_logo.svg.png',
    streamUrl: 'https://g1.globo.com/globo-news/',
    language: 'Portuguese',
  },
  // India
  {
    id: '10',
    name: 'NDTV 24x7',
    country: 'India',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/NDTV_logo.svg/1200px-NDTV_logo.svg.png',
    streamUrl: 'https://www.ndtv.com/live',
    language: 'Hindi',
  },
  // Entertainment channels
  {
    id: '11',
    name: 'National Geographic',
    country: 'USA',
    category: 'Education',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/National_Geographic_logo.svg/1200px-National_Geographic_logo.svg.png',
    streamUrl: 'https://www.nationalgeographic.com/tv',
    language: 'English',
  },
  {
    id: '12',
    name: 'Euronews',
    country: 'France',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Euronews_Logo.svg/1200px-Euronews_Logo.svg.png',
    streamUrl: 'https://www.euronews.com/live',
    language: 'French',
  },
  {
    id: '13',
    name: 'Al Jazeera',
    country: 'UK',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Al_Jazeera_2022.svg/1200px-Al_Jazeera_2022.svg.png',
    streamUrl: 'https://www.aljazeera.com/live',
    language: 'English',
  },
  {
    id: '14',
    name: 'CCTV News',
    country: 'Japan',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/CCTV-News_logo.svg/1200px-CCTV-News_logo.svg.png',
    streamUrl: 'https://www.cctv.com/live/',
    language: 'Chinese',
  },
  {
    id: '15',
    name: 'Telesur',
    country: 'Brazil',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Telesur_logo.svg/1200px-Telesur_logo.svg.png',
    streamUrl: 'https://www.telesurtv.net/live',
    language: 'Spanish',
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

// Get all channels (useful for debugging)
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