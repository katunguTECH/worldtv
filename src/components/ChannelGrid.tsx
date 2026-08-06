import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { Channel } from '../types/channel.types';
import ChannelCard from './ChannelCard';

interface ChannelGridProps {
  channels: Channel[];
  onChannelSelect: (channel: Channel) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

const CARD_HEIGHT = 190;
const MIN_CARD_WIDTH = 150;

const ChannelGrid: React.FC<ChannelGridProps> = ({
  channels,
  onChannelSelect,
  onToggleFavorite,
  isFavorite,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 600 });

  const measure = useCallback(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: Math.max(window.innerHeight - 260, 400),
      });
    }
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  if (dimensions.width === 0) {
    return <div ref={containerRef} className="w-full h-96" />;
  }

  const columnCount = Math.max(Math.floor(dimensions.width / MIN_CARD_WIDTH), 2);
  const columnWidth = dimensions.width / columnCount;
  const rowCount = Math.ceil(channels.length / columnCount);

  const Cell = ({ columnIndex, rowIndex, style }: any) => {
    const index = rowIndex * columnCount + columnIndex;
    if (index >= channels.length) return null;
    const channel = channels[index];
    return (
      <div style={{ ...style, padding: '6px' }}>
        <ChannelCard
          channel={channel}
          onClick={() => onChannelSelect(channel)}
          isFavorite={isFavorite(channel.id)}
          onToggleFavorite={() => onToggleFavorite(channel.id)}
        />
      </div>
    );
  };

  return (
    <div ref={containerRef} className="w-full">
      {channels.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No channels match your search.</div>
      ) : (
        <Grid
          columnCount={columnCount}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={CARD_HEIGHT}
          width={dimensions.width}
          height={dimensions.height}
        >
          {Cell}
        </Grid>
      )}
    </div>
  );
};

export default ChannelGrid;