import React, { useEffect, useRef, useState } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  onChangeRef.current = onChange;
  valueRef.current = value;

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== valueRef.current) {
        onChangeRef.current(localValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🔍</span>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder="Search channels by name, country, or category..."
        className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-3 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-base"
      />
    </div>
  );
};

export default SearchBar;