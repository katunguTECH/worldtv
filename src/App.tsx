import React, { useState } from 'react';
import { Channel } from './types/channel.types';
import { getCountries, getChannelsByCountry, searchChannels } from './services/channelService';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';
import ChannelGrid from './components/ChannelGrid';
import VideoPlayer from './components/VideoPlayer';
import { useFavorites } from './hooks/useFavorites';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  
  const countries = getCountries();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  // Get current channels based on filters
  const getCurrentChannels = () => {
    if (searchQuery) {
      return searchChannels(searchQuery);
    }
    return getChannelsByCountry(selectedCountry);
  };

  const currentChannels = getCurrentChannels();

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
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

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <Sidebar
        selectedCountry={selectedCountry}
        onCountrySelect={handleCountrySelect}
        countries={countries}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-white text-2xl font-bold">🌍 WorldTV</h1>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">
                {currentChannels.length} channels
              </span>
              <button
                onClick={handleRandomChannel}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
              >
                <span>🎲</span> Random
              </button>
            </div>
          </div>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </header>

        {/* Channel Grid */}
        <main className="flex-1 overflow-y-auto p-4">
          <ChannelGrid
            searchQuery={searchQuery}
            selectedCountry={selectedCountry}
            onChannelSelect={handleChannelSelect}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
          />
        </main>
      </div>

      {/* Channel Modal with Video Player */}
      {selectedChannel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start p-4 border-b border-gray-700">
              <div className="flex-1">
                <h2 className="text-white text-xl font-bold">{selectedChannel.name}</h2>
                <div className="flex items-center gap-3 mt-1">
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

            {/* Video Player */}
            <div className="p-4">
              <VideoPlayer 
                streamUrl={selectedChannel.streamUrl} 
                channelName={selectedChannel.name} 
              />
            </div>

            {/* Channel Info Footer */}
            <div className="p-4 border-t border-gray-700 bg-gray-800/50">
              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-400">
                  <span className="font-medium">Stream URL:</span>{' '}
                  <span className="text-gray-500 truncate inline-block max-w-xs">
                    {selectedChannel.streamUrl}
                  </span>
                </div>
                <button
                  onClick={() => window.open(selectedChannel.streamUrl, '_blank')}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition text-xs"
                >
                  Open in new tab
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