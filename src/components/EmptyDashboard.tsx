import React from 'react';
import { Info, Sparkles } from 'lucide-react';
import type { SearchMode } from '../types/corpus';
import type { CorpusStats } from '../hooks/useCorpusData';

export interface ExampleQuery {
  label: string;
  query: string;
  mode: SearchMode;
  description: string;
}

export const EXAMPLE_QUERIES: ExampleQuery[] = [
  {
    label: 'anichuja',
    query: 'anichuja',
    mode: 'dg',
    description: '"boys" — Standard (d/t) spelling',
  },
  {
    label: 'adalenisgv',
    query: 'adalenisgv',
    mode: 'dg',
    description: '"in the beginning" — Standard (d/t) spelling',
  },
  {
    label: 'sgwà:hle̋:sdi',
    query: 'sgwà:hle̋:sdi',
    mode: 'dg',
    description: '"ball" — Dictionary spelling with tone marks',
  },
  {
    label: 'anitshutsa',
    query: 'anitshutsa',
    mode: 'tth',
    description: '"boys" — Linguistic (t/th) spelling',
  },
  {
    label: 'anitsutsa',
    query: 'anitsutsa',
    mode: 'tth',
    description: '"boys" — Relaxed spelling (without h)',
  },
  {
    label: 'tshutsa tananelo',
    query: 'tshutsa tananelo',
    mode: 'tth',
    description: '"boys playing" — Multi-word search',
  },
  {
    label: 'playing ball',
    query: 'playing ball',
    mode: 'english',
    description: 'Search by English meaning',
  },
  {
    label: 'roosters',
    query: 'roosters',
    mode: 'english',
    description: 'Search by English word',
  },
];

export interface EmptyDashboardProps {
  corpusStats: CorpusStats;
  onApplyExample: (ex: ExampleQuery) => void;
}

export const EmptyDashboard: React.FC<EmptyDashboardProps> = ({
  corpusStats,
  onApplyExample,
}) => {
  return (
    <div className="max-w-3xl mx-auto my-4 sm:my-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-8 shadow-xs">
      <div className="flex items-center gap-2 text-sky-700 text-xs font-semibold uppercase tracking-wider mb-2">
        <Sparkles className="w-4 h-4" />
        Ready to Search
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
        Listen to Spoken Cherokee Words & Sentences
      </h2>
      <p className="text-sm text-slate-600 leading-relaxed mb-4">
        Select what you want to search (Standard spelling, Linguistic, or English) in the search bar above and press{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs border border-slate-200">
          Enter
        </kbd>{' '}
        (or click <strong>Search</strong>) to hear{' '}
        <strong className="text-slate-900">
          {corpusStats.totalPhrases.toLocaleString()}
        </strong>{' '}
        spoken recordings ({corpusStats.totalHours} hours of audio) from the{' '}
        <strong className="text-slate-900">
          1975 Durbin Feeling Cherokee Dictionary
        </strong>
        , the{' '}
        <strong className="text-slate-900">Cherokee New Testament</strong>, and{' '}
        <strong className="text-slate-900">Saving the Voices</strong> elder interviews.
      </p>
      <p className="text-xs text-slate-500 leading-relaxed mb-6 flex items-start gap-2 bg-slate-50 border border-slate-200/80 rounded-lg p-3">
        <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
        <span>
          <strong>Note on word timing:</strong> Word-by-word audio timestamps are computer-generated so you can click any word to hear it spoken. Because natural conversation is fast and expressive, the computer alignment can occasionally be slightly off. Hover over any word or badge to view its exact confidence score.
        </span>
      </p>

      {/* Match Quality Color Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6 text-xs">
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <div>
            <div className="font-semibold">Clear Match</div>
            <div className="text-[11px] text-emerald-700">Crisp audio & word timing</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <div>
            <div className="font-semibold">Approximate Match</div>
            <div className="text-[11px] text-amber-700">Fast conversational speech</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
          <div>
            <div className="font-semibold">Uncertain Timing</div>
            <div className="text-[11px] text-rose-700">Timing may be slightly off</div>
          </div>
        </div>
      </div>

      {/* Clickable Example Chips */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Try an Example Search:
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {EXAMPLE_QUERIES.map(ex => (
            <button
              key={`${ex.mode}-${ex.label}`}
              type="button"
              onClick={() => onApplyExample(ex)}
              className="flex items-center justify-between text-left p-3 rounded-xl bg-slate-50 hover:bg-sky-50/70 border border-slate-200 hover:border-sky-300 transition cursor-pointer group shadow-2xs"
            >
              <div>
                <div className="font-mono text-sm font-semibold text-sky-800 group-hover:text-sky-950">
                  "{ex.label}"
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {ex.description}
                </div>
              </div>
              <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shadow-2xs">
                {ex.mode === 'dg'
                  ? 'Standard'
                  : ex.mode === 'tth'
                    ? 'Linguistic'
                    : 'English'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
