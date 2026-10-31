import React from 'react';
import { Eye, EyeOff, Gauge, Layers } from 'lucide-react';
import type { DocumentMeta, SortOption, SourceType } from '../types/corpus';

export const SOURCE_TYPE_OPTIONS: Array<{
  value: 'all' | SourceType;
  label: string;
  shortLabel: string;
}> = [
  { value: 'all', label: 'All Collections', shortLabel: 'All' },
  { value: 'dictionary_collection', label: '1975 Dictionary', shortLabel: 'Dictionary' },
  { value: 'biblical_chapter', label: 'New Testament', shortLabel: 'Bible' },
  { value: 'marked_syllabary_corpus', label: 'Saving the Voices', shortLabel: 'Interviews' },
];

export interface FilterBarProps {
  showMobileFilters: boolean;
  selectedSourceType: 'all' | SourceType;
  onSourceTypeChange: (type: 'all' | SourceType) => void;
  selectedSourceId: string;
  onSourceIdChange: (id: string) => void;
  availableSources: DocumentMeta[];
  showLowConfidence: boolean;
  onToggleLowConfidence: () => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  groupBySource: boolean;
  onGroupBySourceChange: (checked: boolean) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  showMobileFilters,
  selectedSourceType,
  onSourceTypeChange,
  selectedSourceId,
  onSourceIdChange,
  availableSources,
  showLowConfidence,
  onToggleLowConfidence,
  sortBy,
  onSortChange,
  groupBySource,
  onGroupBySourceChange,
}) => {
  return (
    <div
      className={`${
        showMobileFilters ? 'flex' : 'hidden md:flex'
      } flex-col gap-2 pt-2.5 mt-2 border-t border-slate-200 text-xs`}
    >
      {/* Row 1: Source Collection Pills & Specific Source Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <Layers className="w-3.5 h-3.5 text-slate-500 ml-1 mr-0.5 hidden sm:inline" />
          {SOURCE_TYPE_OPTIONS.map(opt => {
            const active = selectedSourceType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSourceTypeChange(opt.value)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-white text-sky-700 shadow-2xs border border-slate-200 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 border border-transparent'
                }`}
              >
                <span className="sm:hidden">{opt.shortLabel}</span>
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>

        <select
          aria-label="Filter by specific source"
          value={selectedSourceId}
          onChange={e => onSourceIdChange(e.target.value)}
          className="w-full sm:w-auto bg-white border border-slate-300 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500 max-w-full sm:max-w-[230px] truncate shadow-2xs"
        >
          <option value="all">
            All Sources ({availableSources.length})
          </option>
          {availableSources.map(s => (
            <option key={s.source_id} value={s.source_id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      {/* Row 2: Uncertain Matches, Sort, Grouping */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 sm:border-t-0">
        <button
          type="button"
          onClick={onToggleLowConfidence}
          title={
            showLowConfidence
              ? 'Currently including recordings where computer word-timing is very uncertain (<5% confidence). Click to hide them.'
              : 'Recordings where computer word-timing is very uncertain (<5% confidence) are hidden by default. Click to include them.'
          }
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition ${
            showLowConfidence
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {showLowConfidence ? (
            <>
              <Eye className="w-3.5 h-3.5 text-amber-600" />
              <span>Including uncertain matches</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Include uncertain matches</span>
            </>
          )}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Sort:</span>
            <select
              aria-label="Sort results"
              value={sortBy}
              onChange={e => onSortChange(e.target.value as SortOption)}
              className="bg-white border border-slate-300 text-slate-800 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-sky-500 shadow-2xs"
            >
              <option value="matched_confidence">Best Audio Match</option>
              <option value="phrase_confidence">Clearest Recording</option>
              <option value="shortest_sentence">Shortest Phrase</option>
              <option value="canonical">Book / Interview Order</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer select-none shadow-2xs transition">
            <input
              type="checkbox"
              checked={groupBySource}
              onChange={e => onGroupBySourceChange(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
            />
            <span>Group by source</span>
          </label>
        </div>
      </div>
    </div>
  );
};
