import React from 'react';

interface SidebarProps {
  selectedCountry: string;
  onCountrySelect: (country: string) => void;
  countries: string[];
  selectedCategory?: string;
  onCategorySelect?: (category: string) => void;
  categories?: string[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  selectedCountry, 
  onCountrySelect, 
  countries,
  selectedCategory,
  onCategorySelect,
  categories 
}) => {
  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto hidden md:block">
      <h2 className="text-white font-bold mb-4 text-lg">🌍 Countries</h2>
      <div className="space-y-1 mb-4">
        {countries.map((country) => (
          <button
            key={country}
            onClick={() => onCountrySelect(country)}
            className={`w-full text-left px-3 py-2 rounded transition ${
              selectedCountry === country
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {country === 'All' ? '🌐 All Countries' : country}
          </button>
        ))}
      </div>
      
      {categories && onCategorySelect && (
        <>
          <h2 className="text-white font-bold mb-4 text-lg mt-6">📺 Categories</h2>
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => onCategorySelect(category)}
                className={`w-full text-left px-3 py-2 rounded transition ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {category === 'All' ? '📋 All Categories' : category}
              </button>
            ))}
          </div>
        </>
      )}
      
      <div className="mt-6 pt-6 border-t border-gray-700">
        <p className="text-gray-500 text-xs">
          📡 {countries.length - 1} countries available
        </p>
      </div>
    </div>
  );
};

export default Sidebar;