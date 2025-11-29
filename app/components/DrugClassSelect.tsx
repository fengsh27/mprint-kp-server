'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from 'lucide-react';

interface DrugClassHierarchy {
  level1: string[];
  level2: string[];
  level3: string[];
}

interface DrugClassSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  hierarchy: DrugClassHierarchy;
  searchPlaceholder?: string;
}

export default function DrugClassSelect({
  value,
  onValueChange,
  placeholder,
  hierarchy,
  searchPlaceholder = "Search drug class...",
}: DrugClassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownContentRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Build flat list of options with hierarchy display
  const buildOptions = () => {
    const options: Array<{ value: string; label: string; level: number }> = [];
    
    // Add level 1 items
    hierarchy.level1.forEach(item => {
      options.push({ value: item, label: item, level: 1 });
    });
    
    // Add level 2 items
    hierarchy.level2.forEach(item => {
      options.push({ value: item, label: item, level: 2 });
    });
    
    // Add level 3 items
    hierarchy.level3.forEach(item => {
      options.push({ value: item, label: item, level: 3 });
    });
    
    return options;
  };

  const allOptions = buildOptions();

  // Filter options based on search term
  const filteredOptions = searchTerm
    ? allOptions.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allOptions;

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

  // Scroll to selected item when dropdown opens
  useEffect(() => {
    if (isOpen && value && !searchTerm && selectedItemRef.current && dropdownContentRef.current) {
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        if (selectedItemRef.current && dropdownContentRef.current) {
          const dropdownContainer = dropdownContentRef.current;
          const selectedElement = selectedItemRef.current;
          
          // Calculate scroll position to center the selected item
          const containerRect = dropdownContainer.getBoundingClientRect();
          const elementRect = selectedElement.getBoundingClientRect();
          const scrollTop = dropdownContainer.scrollTop;
          const elementTop = elementRect.top - containerRect.top + scrollTop;
          const elementHeight = selectedElement.offsetHeight;
          const containerHeight = dropdownContainer.clientHeight;
          
          // Scroll to center the element in the container
          dropdownContainer.scrollTo({
            top: elementTop - (containerHeight / 2) + (elementHeight / 2),
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [isOpen, value, searchTerm]);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectedOption = allOptions.find(option => option.value === value);

  const getLevelLabel = (level: number) => {
    switch (level) {
      case 1:
        return 'level 1';
      case 2:
        return 'level 2';
      case 3:
        return 'level 3';
      default:
        return '';
    }
  };

  // Group options by level for display
  const groupedOptions = filteredOptions.reduce((acc, option) => {
    if (!acc[option.level]) {
      acc[option.level] = [];
    }
    acc[option.level].push(option);
    return acc;
  }, {} as Record<number, Array<{ value: string; label: string; level: number }>>);

  return (
    <div className="relative" ref={dropdownRef} style={{ width: '100%' }}>
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
        <div 
          ref={dropdownContentRef}
          className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-md shadow-lg" 
          style={{ width: '100%', maxHeight: '400px', overflowY: 'auto' }}
        >
          {/* Search Input - Always visible at top */}
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white z-20 shadow-sm">
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

          {/* Grouped Options */}
          {Object.keys(groupedOptions).length > 0 ? (
            <div>
              {[1, 2, 3].map(level => {
                const levelOptions = groupedOptions[level] || [];
                if (levelOptions.length === 0) return null;

                return (
                  <div key={level}>
                    {/* Level Header */}
                    <div className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-blue-50 border-t border-b border-blue-200 sticky top-[49px] z-10">
                      {getLevelLabel(level)}
                    </div>
                    {/* Level Separator */}
                    <div className="px-3 py-1 text-xs text-gray-400">
                      {'─'.repeat(20)}
                    </div>
                    {/* Level Items */}
                    {levelOptions.map(option => (
                      <div
                        key={option.value}
                        ref={option.value === value ? selectedItemRef : null}
                        className={`px-3 py-2 text-sm cursor-pointer ${
                          option.value === value 
                            ? 'bg-blue-100 text-blue-900 font-medium' 
                            : 'text-gray-700 hover:bg-blue-50'
                        }`}
                        onClick={() => handleSelect(option.value)}
                      >
                        {option.label}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

