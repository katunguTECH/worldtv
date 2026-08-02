import React from 'react';
import { Channel } from '../types/channel.types';

interface ChannelCardProps {
  channel: Channel;
  onClick: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ 
  channel, 
  onClick, 
  isFavorite, 
  onToggleFavorite 
}) => {
  return (
    <div className="relative">
      <div 
        className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-all cursor-pointer border border-gray-700 hover:border-blue-500 hover:scale-105 transform duration-200"
        onClick={onClick}
      >
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
            <img 
              src={channel.logo} 
              alt={channel.name}
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%23333"/><text x="40" y="45" text-anchor="middle" fill="%23666" font-size="12">${channel.name.substring(0, 3)}</text></svg>`;
              }}
            />
          </div>
          <h3 className="text-white text-sm text-center font-medium truncate w-full max-w-[120px]">
            {channel.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-400 text-xs">{channel.country}</span>
            <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">
              {channel.category}
            </span>
          </div>
          <span className="text-xs text-gray-500 mt-1">{channel.language}</span>
        </div>
      </div>
      
      {/* Favorite Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="absolute top-2 right-2 text-xl transition hover:scale-110"
      >
        {isFavorite ? '⭐' : '☆'}
      </button>
    </div>
  );
};

export default ChannelCard;