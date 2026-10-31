import React from 'react';
import { HelpCircle } from 'lucide-react';
import type { CorpusStats } from '../hooks/useCorpusData';

export interface HeaderProps {
  loading: boolean;
  corpusStats: CorpusStats;
  onOpenTerminology: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  loading,
  corpusStats,
  onOpenTerminology,
}) => {
  return (
    <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-bold text-lg sm:text-xl shadow-2xs shrink-0">
          Ꭰ
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2 truncate">
            Digoliyetanidasdi
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 truncate hidden sm:block">
            Search Spoken Cherokee Recordings & Translations
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0">
        <button
          type="button"
          onClick={onOpenTerminology}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition cursor-pointer"
          title="Learn how Cherokee spelling search and audio word highlighting work"
        >
          <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
          <span>How It Works</span>
        </button>

        {!loading && (
          <div className="hidden md:flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 shadow-2xs">
              Recordings: <strong className="text-slate-900">{corpusStats.totalPhrases.toLocaleString()}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 shadow-2xs">
              Sources: <strong className="text-slate-900">{corpusStats.totalSources}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
