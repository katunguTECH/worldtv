import React, { useState, useEffect } from 'react';
import { Channel } from './types/channel.types';
import { 
  initializeChannels, 
  getCountries, 
  getCategories, 
  getChannelsByCountry, 
  searchChannels,
  refreshChannels
} from './services/channelService';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';
import ChannelGrid from './components/ChannelGrid';
import VideoPlayer from './components/VideoPlayer';
import { useFavorites } from './hooks/useFavorites';

function App() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [currentChannels, setCurrentChannels] = useState<Channel[]>([]);
  
  const countries = getCountries();
  const categories = getCategories();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  // Initialize channels on mount
  useEffect(() => {
    const loadChannels = async () => {
      setLoading(true);
      try {
        console.log('🚀 App: Loading channels...');
        await initializeChannels();
        console.log('📊 App: Channels initialized, loading from service...');
        const channels = getChannelsByCountry('All');
        console.log(`📺 App: Loaded ${channels.length} channels`);
        setCurrentChannels(channels);
      } catch (error) {
        console.error('❌ App: Error loading channels:', error);
      } finally {
        setLoading(false);
      }
    };
    loadChannels();
  }, []);

  // Update channels when filters change
  useEffect(() => {
    if (loading) return;
    
    let channels = [];
    if (searchQuery) {
      channels = searchChannels(searchQuery);
    } else {
      channels = getChannelsByCountry(selectedCountry);
      if (selectedCategory !== 'All') {
        channels = channels.filter(ch => ch.category === selectedCategory);
      }
    }
    setCurrentChannels(channels);
  }, [searchQuery, selectedCountry, selectedCategory, loading]);

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    setSearchQuery('');
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setSearchQuery('');
  };

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
  };

  const handleRandomChannel = () => {
    if (currentChannels.length === 0) return;
    const randomIndex = Math.floor(Math.random() * currentChannels.length);
    setSelectedChannel(currentChannels[randomIndex]);
  };

  const handleCloseModal = () => {
    setSelectedChannel(null);
  };

  const handleRefreshChannels = async () => {
    setLoading(true);
    try {
      console.log('🔄 Refreshing channels...');
      await refreshChannels();
      const channels = getChannelsByCountry('All');
      console.log(`📺 App: Refreshed ${channels.length} channels`);
      setCurrentChannels(channels);
    } catch (error) {
      console.error('❌ App: Error refreshing channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = () => {
    if (window.confirm('Clear all cached data and refresh?')) {
      localStorage.removeItem('iptv_channels');
      localStorage.removeItem('favorites');
      alert('Cache cleared! Click Refresh to reload channels.');
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-white text-4xl mb-4">🌍</div>
          <div className="text-white text-xl animate-pulse">Loading channels...</div>
          <div className="text-gray-400 text-sm mt-2">This may take a moment</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar
        selectedCountry={selectedCountry}
        onCountrySelect={handleCountrySelect}
        countries={countries}
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
        categories={categories}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-white text-2xl font-bold">🌍 WorldTV</h1>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">
                {currentChannels.length} channels
              </span>
              <button
                onClick={handleClearCache}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition flex items-center gap-1 text-sm"
              >
                🗑️ Clear
              </button>
              <button
                onClick={handleRefreshChannels}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition flex items-center gap-1 text-sm"
              >
                🔄 Refresh
              </button>
              <button
                onClick={handleRandomChannel}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition flex items-center gap-1 text-sm"
              >
                🎲 Random
              </button>
            </div>
          </div>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          <ChannelGrid
            channels={currentChannels}
            onChannelSelect={handleChannelSelect}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
          />
        </main>
      </div>

      {selectedChannel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-4 border-b border-gray-700">
              <div className="flex-1">
                <h2 className="text-white text-xl font-bold">{selectedChannel.name}</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-gray-400 text-sm">{selectedChannel.country}</span>
                  <span className="text-blue-400 text-sm bg-blue-900/30 px-2 py-0.5 rounded">
                    {selectedChannel.category}
                  </span>
                  <span className="text-gray-500 text-sm">{selectedChannel.language}</span>
                  <button
                    onClick={() => toggleFavorite(selectedChannel.id)}
                    className={`text-xl transition ${
                      isFavorite(selectedChannel.id) ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'
                    }`}
                  >
                    {isFavorite(selectedChannel.id) ? '⭐' : '☆'}
                  </button>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-white text-2xl leading-none ml-4"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <VideoPlayer 
                streamUrl={selectedChannel.streamUrl} 
                channelName={selectedChannel.name} 
              />
            </div>

            <div className="p-4 border-t border-gray-700 bg-gray-800/50">
              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-400 truncate">
                  <span className="font-medium">Stream URL:</span>{' '}
                  <span className="text-gray-500 truncate inline-block max-w-xs">
                    {selectedChannel.streamUrl}
                  </span>
                </div>
                <button
                  onClick={() => window.open(selectedChannel.streamUrl, '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                >
                  ↗ Open in new tab
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;