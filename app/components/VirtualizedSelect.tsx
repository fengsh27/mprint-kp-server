'use client';

import React, { useState, useRef, useEffect } from 'react';
import { List } from 'react-virtualized';
import { ChevronDownIcon } from 'lucide-react';

interface VirtualizedSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string; description?: string }>;
  searchPlaceholder?: string;
  maxHeight?: number;
  itemHeight?: number;
  width?: string;
  maxWidth?: string;
}

export default function VirtualizedSelect({
  value,
  onValueChange,
  placeholder,
  options,
  searchPlaceholder = "Search...",
  maxHeight = 300,
  itemHeight = 40,
  width = "100%",
  maxWidth = "100%",
}: VirtualizedSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on search term
  useEffect(() => {
    const filtered = options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (option.description && option.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredOptions(filtered);
  }, [searchTerm, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectedOption = options.find(option => option.value === value);

  // Virtualized row renderer
  const rowRenderer = ({ index, key, style }: any) => {
    const option = filteredOptions[index];
    if (!option) return null;

    return (
      <div
        key={key}
        style={style}
        className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-100"
        onClick={() => handleSelect(option.value)}
      >
        {option.description ? (
          <div className="w-full flex flex-col">
            <div className="font-bold text-sm truncate" title={option.label}>
              {option.label}
            </div>
            <div className="text-gray-500 text-xs truncate mt-1" title={option.description}>
              {option.description}
            </div>
          </div>
        ) : (
          <div className="w-full truncate" title={option.label}>
            {option.label}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ width, maxWidth }}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white flex items-center justify-between"
      >
        <span className={selectedOption ? "text-gray-900" : "text-gray-500"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon className="w-4 h-4 text-gray-400" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-md shadow-lg" style={{ width: width === "100%" ? "100%" : width }}>
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Select Option */}
          <div 
            className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-200"
            onClick={() => handleSelect("")}
          >
            Select
          </div>

          {/* Virtualized List */}
          {filteredOptions.length > 0 && (
            <div style={{ width: width === "100%" ? "100%" : width }}>
              <List
                height={Math.min(maxHeight, filteredOptions.length * itemHeight)}
                rowCount={filteredOptions.length}
                rowHeight={itemHeight}
                maxWidth={300}
                width={210}
                rowRenderer={rowRenderer}
                className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
              />
            </div>
          )}

          {/* No Results */}
          {filteredOptions.length === 0 && searchTerm && (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              No results found
            </div>
          )}

          {/* Results Count */}
          {searchTerm && (
            <div className="px-3 py-2 text-xs text-gray-500 text-center border-t border-gray-100 bg-gray-50">
              {filteredOptions.length} of {options.length} items found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
