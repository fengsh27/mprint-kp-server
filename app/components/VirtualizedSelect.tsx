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
  const listRef = useRef<List>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

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

  // Scroll to selected option when dropdown opens with smooth animation
  useEffect(() => {
    if (isOpen && value && !searchTerm && listRef.current && listContainerRef.current) {
      // Find the index of the selected option in filtered options
      const selectedIndex = filteredOptions.findIndex(option => option.value === value);
      if (selectedIndex >= 0) {
        // Use setTimeout to ensure the list is rendered before scrolling
        setTimeout(() => {
          // Find the scrollable container inside the List component
          // react-virtualized List creates a Grid with a scrollable div
          let scrollableElement: HTMLElement | null = null;
          
          // Try different selectors to find the scrollable element
          scrollableElement = listContainerRef.current?.querySelector('.ReactVirtualized__Grid') as HTMLElement ||
                             listContainerRef.current?.querySelector('[role="grid"]') as HTMLElement ||
                             listContainerRef.current?.querySelector('div[style*="overflow"]') as HTMLElement;
          
          // If still not found, find any element with overflow scroll/auto
          if (!scrollableElement && listContainerRef.current) {
            const allDivs = listContainerRef.current.querySelectorAll('div');
            for (const div of Array.from(allDivs)) {
              const style = window.getComputedStyle(div);
              if (style.overflow === 'auto' || style.overflow === 'scroll' || 
                  style.overflowY === 'auto' || style.overflowY === 'scroll') {
                scrollableElement = div;
                break;
              }
            }
          }
          
          if (scrollableElement) {
            // Calculate scroll position: row index * item height
            // Center the selected item in the viewport for better visibility
            const scrollPosition = selectedIndex * itemHeight;
            const containerHeight = scrollableElement.clientHeight;
            const centeredScroll = Math.max(0, scrollPosition - (containerHeight / 2) + (itemHeight / 2));
            
            // Use smooth scroll animation
            scrollableElement.scrollTo({
              top: centeredScroll,
              behavior: 'smooth'
            });
          } else {
            // Fallback to scrollToRow if we can't find the scrollable element
            if (listRef.current) {
              listRef.current.scrollToRow(selectedIndex);
            }
          }
        }, 100);
      }
    }
  }, [isOpen, value, searchTerm, filteredOptions, itemHeight]);

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

    const isSelected = option.value === value;

    return (
      <div
        key={key}
        style={style}
        className={`px-3 py-2 text-sm cursor-pointer border-b border-gray-100 ${
          isSelected 
            ? 'bg-blue-100 text-blue-900 font-medium' 
            : 'text-gray-700 hover:bg-blue-50'
        }`}
        onClick={() => handleSelect(option.value)}
      >
        {option.description ? (
          <div className="w-full flex flex-col">
            <div className="font-bold text-sm truncate" title={option.label}>
              {option.label}
            </div>
            <div className={`text-xs truncate mt-1 ${isSelected ? 'text-blue-700' : 'text-gray-500'}`} title={option.description}>
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
        <span className={`${selectedOption ? "text-gray-900" : "text-gray-500"} truncate flex-1 text-left`} title={selectedOption ? selectedOption.label : placeholder}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
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
            <div ref={listContainerRef} style={{ width: width === "100%" ? "100%" : width }}>
              <List
                ref={listRef}
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
