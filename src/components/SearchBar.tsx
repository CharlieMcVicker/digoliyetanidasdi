import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { SearchMode } from '../types/corpus';

export interface SearchModeOption {
  value: SearchMode;
  label: string;
  mobileLabel: string;
  placeholder: string;
}

export const SEARCH_MODE_OPTIONS: SearchModeOption[] = [
  {
    value: 'dg',
    label: 'Standard Spelling (d/t)',
    mobileLabel: 'Standard (d/t)',
    placeholder: 'e.g. anichuja, adalenisgv, sgwà:hle̋:sdi...',
  },
  {
    value: 'tth',
    label: 'Linguistic Spelling (t/th)',
    mobileLabel: 'Linguistic (t/th)',
    placeholder: 'e.g. anitshutsa, atalenihskv...',
  },
  {
    value: 'english',
    label: 'English Meaning',
    mobileLabel: 'English Meaning',
    placeholder: 'e.g. playing ball, roosters, beginning...',
  },
];

export interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  committedQuery: string;
  isDirty: boolean;
  onExecuteSearch: () => void;
  onClearInput: () => void;
  totalMatches: number;
  groupedResultsCount: number;
  showMobileFilters: boolean;
  setShowMobileFilters: React.Dispatch<React.SetStateAction<boolean>>;
  activeFilterCount: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  searchMode,
  setSearchMode,
  committedQuery,
  isDirty,
  onExecuteSearch,
  onClearInput,
  totalMatches,
  groupedResultsCount,
  showMobileFilters,
  setShowMobileFilters,
  activeFilterCount,
}) => {
  const activeModeConfig =
    SEARCH_MODE_OPTIONS.find(m => m.value === searchMode) || SEARCH_MODE_OPTIONS[0];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onExecuteSearch();
    }
  };

  return (
    <>
      {/* Unified Search Bar with Mode Selector Dropdown */}
      <div className="flex items-stretch rounded-xl border border-slate-300 bg-white shadow-xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all">
        {/* Search Mode Dropdown */}
        <div className="relative flex items-center border-r border-slate-200 bg-slate-50/90 hover:bg-slate-100 rounded-l-xl transition shrink-0">
          <select
            aria-label="Search mode"
            value={searchMode}
            onChange={e => setSearchMode(e.target.value as SearchMode)}
            className="appearance-none bg-transparent pl-2.5 sm:pl-3.5 pr-6 sm:pr-8 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none max-w-[125px] sm:max-w-none truncate"
          >
            {SEARCH_MODE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 absolute right-1.5 sm:right-2.5 pointer-events-none" />
        </div>

        {/* Input */}
        <div className="relative flex-1 flex items-center min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 sm:left-3 pointer-events-none shrink-0" />
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeModeConfig.placeholder}
            className={`w-full bg-transparent pl-8 sm:pl-9 pr-7 sm:pr-8 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none ${
              searchMode !== 'english' ? 'font-mono' : ''
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={onClearInput}
              aria-label="Clear search input"
              className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Button */}
        <button
          type="button"
          onClick={onExecuteSearch}
          disabled={!searchQuery.trim() && !committedQuery.trim()}
          className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-r-xl font-semibold text-xs sm:text-sm transition cursor-pointer shrink-0 ${
            isDirty && searchQuery.trim()
              ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs animate-pulse'
              : searchQuery.trim()
                ? 'bg-sky-600 hover:bg-sky-700 text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border-l border-slate-200'
          }`}
        >
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">
            {isDirty && committedQuery ? 'Update' : 'Search'}
          </span>
          <span className="hidden md:inline-flex items-center gap-0.5 text-[10px] opacity-85 font-mono ml-0.5 px-1 py-0.2 rounded bg-black/15">
            <CornerDownLeft className="w-2.5 h-2.5" />
            Enter
          </span>
        </button>
      </div>

      {/* Compact Bar: Status Summary + Mobile Filter Toggle Button */}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {committedQuery.trim() ? (
            <div className="text-slate-600 truncate text-[11px] sm:text-xs">
              <span>
                <strong className="text-slate-900">{totalMatches}</strong>{' '}
                {totalMatches === 1 ? 'recording' : 'recordings'}
              </span>
              <span className="hidden sm:inline">
                {' '}across <strong className="text-slate-900">{groupedResultsCount}</strong>{' '}
                {groupedResultsCount === 1 ? 'source' : 'sources'} for{' '}
                <span className="font-mono text-sky-700 font-semibold">"{committedQuery}"</span>
              </span>
              {isDirty && searchQuery.trim() && (
                <span className="ml-1.5 text-amber-700 font-medium hidden sm:inline">
                  • Press Enter to search "{searchQuery.trim()}"
                </span>
              )}
            </div>
          ) : (
            <div className="text-slate-500 truncate text-[11px] sm:text-xs">
              {searchQuery.trim()
                ? 'Press Enter or click Search to find recordings.'
                : 'Cherokee audio corpus search with word-level alignment.'}
            </div>
          )}
        </div>

        {/* Mobile Filters Toggle Button */}
        <button
          type="button"
          onClick={() => setShowMobileFilters(prev => !prev)}
          className={`md:hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition shrink-0 ${
            showMobileFilters || activeFilterCount > 0
              ? 'bg-sky-50 border-sky-300 text-sky-800'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-sky-600 text-white text-[10px] flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
          {showMobileFilters ? (
            <ChevronUp className="w-3 h-3 text-slate-500" />
          ) : (
            <ChevronDown className="w-3 h-3 text-slate-500" />
          )}
        </button>
      </div>
    </>
  );
};
