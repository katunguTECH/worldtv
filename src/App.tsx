import React, { useState } from 'react';
import { Channel } from './types/channel.types';
import { getCountries } from './services/channelService';
import ChannelGrid from './components/ChannelGrid';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  const countries = getCountries();

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    setSearchQuery('');
  };

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
  };

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar
        selectedCountry={selectedCountry}
        onCountrySelect={handleCountrySelect}
        countries={countries}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="p-4 border-b border-gray-700">
          <h1 className="text-white text-2xl font-bold mb-3">WorldTV</h1>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          <ChannelGrid
            searchQuery={searchQuery}
            selectedCountry={selectedCountry}
            onChannelSelect={handleChannelSelect}
          />
        </main>
      </div>

      {selectedChannel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setSelectedChannel(null)}
        >
          <div
            className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-white text-xl font-bold">{selectedChannel.name}</h2>
              <button
                onClick={() => setSelectedChannel(null)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                X
              </button>
            </div>
            <p className="text-gray-300 mb-1">Country: {selectedChannel.country}</p>
            <p className="text-gray-300 mb-1">Category: {selectedChannel.category}</p>
            <p className="text-gray-300 mb-4">Language: {selectedChannel.language}</p>
            <a
              href={selectedChannel.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Watch Stream
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
