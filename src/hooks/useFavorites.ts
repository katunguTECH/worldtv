import { useState, useEffect } from 'react';

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading favorites:', e);
        setFavorites([]);
      }
    }
  }, []);

  const toggleFavorite = (channelId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId];
      
      // Save to localStorage
      localStorage.setItem('favorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  const isFavorite = (channelId: string) => {
    return favorites.includes(channelId);
  };

  return { favorites, toggleFavorite, isFavorite };
};