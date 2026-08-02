import React, { useState, useEffect } from 'react';
import { Channel } from '../types/channel.types';
import { searchChannels, getChannelsByCountry } from '../services/channelService';
import ChannelCard from './ChannelCard';

interface ChannelGridProps {
  searchQuery: string;
  selectedCountry: string;
  onChannelSelect: (channel: Channel) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

const ChannelGrid: React.FC<ChannelGridProps> = ({ 
  searchQuery, 
  selectedCountry, 
  onChannelSelect,
  favorites,
  onToggleFavorite,
  isFavorite
}) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChannels = async () => {
      setLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        let data;
        if (searchQuery) {
          data = searchChannels(searchQuery);
        } else {
          data = getChannelsByCountry(selectedCountry);
        }
        setChannels(data);
      } catch (error) {
        console.error('Error fetching channels:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [searchQuery, selectedCountry]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-white text-xl animate-pulse">📡 Loading channels...</div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="text-gray-400 text-4xl mb-4">🔍</div>
        <div className="text-gray-400 text-xl">No channels found</div>
        <div className="text-gray-500 text-sm mt-2">Try a different search or country</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {channels.map((channel) => (
        <ChannelCard 
          key={channel.id} 
          channel={channel} 
          onClick={() => onChannelSelect(channel)}
          isFavorite={isFavorite(channel.id)}
          onToggleFavorite={() => onToggleFavorite(channel.id)}
        />
      ))}
    </div>
  );
};

export default ChannelGrid;