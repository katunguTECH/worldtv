import React, { useState } from 'react';

interface SidebarProps {
  selectedCountry: string;
  onCountrySelect: (country: string) => void;
  countries: string[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  categories: string[];
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedCountry,
  onCountrySelect,
  countries,
  selectedCategory,
  onCategorySelect,
  categories,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const content = (
    <div className="p-4 overflow-y-auto h-full">
      <h2 className="text-white font-semibold mb-2">🌍 Countries</h2>
      <div className="space-y-1 mb-6">
        {countries.map((c) => (
          <button
            key={c}
            onClick={() => {
              onCountrySelect(c);
              setMobileOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded transition ${
              selectedCountry === c ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {categories.length > 1 && (
        <>
          <h2 className="text-white font-semibold mb-2">Categories</h2>
          <div className="space-y-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onCategorySelect(c);
                  setMobileOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded transition ${
                  selectedCategory === c ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 bg-gray-800 border-r border-gray-700 flex-shrink-0">
        {content}
      </aside>

      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-4 left-4 z-30 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg text-xl"
          aria-label="Open filters"
        >
          🌍
        </button>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex">
            <div className="w-72 max-w-[80vw] bg-gray-800 h-full">{content}</div>
            <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;