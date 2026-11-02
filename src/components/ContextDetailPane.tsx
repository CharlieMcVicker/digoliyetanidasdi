import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  X,
} from 'lucide-react';
import type {
  DocumentMeta,
  PhraseRecord,
  ScoredPhraseMatch,
  SearchMode,
  TurnContainerModel,
  TurnRecord,
} from '../types/corpus';
import { buildOrderedSourceContextWindow } from '../lib/search';
import { ContextPhraseRow } from './context/ContextPhraseRow';
import { TurnCard } from './TurnCard';

export interface ContextDetailPaneProps {
  targetPhrase: PhraseRecord;
  source: DocumentMeta;
  allPhrases: PhraseRecord[];
  scoredMatchesMap: Map<string, ScoredPhraseMatch>;
  turnPartCountsMap: Map<
    string,
    { turnId: string; phraseIndex: number; turnPhraseCount: number }
  >;
  query: string;
  mode: SearchMode;
  activeAudioPhraseId: string | null;
  onActivateAudio: (phraseId: string) => void;
  onSelectContextPhrase: (phrase: PhraseRecord) => void;
  onClose: () => void;
}

export const ContextDetailPane: React.FC<ContextDetailPaneProps> = ({
  targetPhrase,
  source,
  allPhrases,
  scoredMatchesMap,
  query,
  mode,
  activeAudioPhraseId,
  onActivateAudio,
  onClose,
}) => {
  const isBible = source.source_type === 'biblical_chapter';
  const defaultRadius = isBible ? 3 : 1;

  const [radiusBefore, setRadiusBefore] = useState(defaultRadius);
  const [radiusAfter, setRadiusAfter] = useState(defaultRadius);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const r = source.source_type === 'biblical_chapter' ? 3 : 1;
    setRadiusBefore(r);
    setRadiusAfter(r);
  }, [targetPhrase.id, source.source_type]);

  const contextWindow = buildOrderedSourceContextWindow(
    targetPhrase,
    source,
    allPhrases,
    radiusBefore,
    radiusAfter
  );

  // Scroll only the internal drawer container to the selected phrase
  useEffect(() => {
    const container = scrollContainerRef.current;
    const el = document.getElementById(`context-target-${targetPhrase.id}`);
    if (container && el) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetScrollTop =
        container.scrollTop +
        (elRect.top - containerRect.top) -
        Math.max(24, (containerRect.height - elRect.height) / 3);
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }, [targetPhrase.id]);

  // Escape key closes the drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!contextWindow) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Clickable grayed-out backdrop overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/35 backdrop-blur-[1px] transition-opacity cursor-pointer"
      />

      <aside
        aria-label="Source Context View"
        className="relative z-10 w-full lg:w-[46vw] lg:max-w-xl h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Top Bar */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-700">
                {isBible ? (
                  <>
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>Chapter Context • Click any word to hear it</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>Interview Context • Click any word to hear it</span>
                  </>
                )}
              </div>
              <h2 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                {source.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer shrink-0"
            title="Close context panel (Esc)"
          >
            <span>Close</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Context Body */}
        <div
          ref={scrollContainerRef}
          className="px-3 sm:px-5 py-3 sm:py-4 overflow-y-auto flex-1 divide-y divide-slate-200"
        >
          {/* Load Earlier Button */}
          {contextWindow.hasPrevious && (
            <div className="pb-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setRadiusBefore(prev => prev + (isBible ? 5 : 2))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>
                  {isBible ? 'Earlier verses' : 'Earlier turns'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRadiusBefore(9999);
                  setRadiusAfter(9999);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-600 text-xs border border-slate-200 transition cursor-pointer"
              >
                <span>
                  {contextWindow.kind === 'biblical_chapter'
                    ? `All ${contextWindow.totalVerses} verses`
                    : `All ${contextWindow.totalTurns} turns`}
                </span>
              </button>
            </div>
          )}

          {/* Bible Chapter Verses */}
          {contextWindow.kind === 'biblical_chapter' &&
            contextWindow.verses.map(verse => {
              const scored = scoredMatchesMap.get(verse.id) ?? verse;
              const isTarget = verse.id === targetPhrase.id;
              return (
                <div
                  key={verse.id}
                  id={isTarget ? `context-target-${verse.id}` : undefined}
                >
                  <ContextPhraseRow
                    phrase={scored}
                    showEnglishAtBottom={true}
                    isContextTarget={isTarget}
                    query={query}
                    mode={mode}
                    isActiveAudio={activeAudioPhraseId === verse.id}
                    onActivateAudio={onActivateAudio}
                  />
                </div>
              );
            })}

          {/* Saving the Voices Interview Turns */}
          {contextWindow.kind === 'marked_syllabary_corpus' &&
            contextWindow.turns.map((t: TurnContainerModel) => {
              const turnRecord: TurnRecord = {
                id: `${source.source_id}::${t.turnId}`,
                turn_id: t.turnId,
                source_id: source.source_id,
                speaker_label: t.speakerLabel,
                loc_label: `Turn ${t.turnId.replace('seg-', '')}`,
                loc_index: t.phrases[0]?.loc_index ?? 0,
                english_text: t.englishText,
                turn_audio_path: t.turnAudioPath,
                turn_start_sec: t.turnStartSec,
                turn_end_sec: t.turnEndSec,
                duration_sec: Math.max(0, t.turnEndSec - t.turnStartSec),
                mean_confidence:
                  t.phrases.reduce((acc, p) => acc + (p.mean_confidence || 0), 0) /
                  (t.phrases.length || 1),
                has_anomalies: t.phrases.some(p => p.has_anomalies),
                phrases: t.phrases,
                syllabary_text: t.phrases.map(p => p.syllabary_text).join(' '),
                phonetic_text: t.phrases.map(p => p.phonetic_text).join(' '),
                phonetic_broad: t.phrases.map(p => p.phonetic_broad).join(' '),
              };

              return (
                <div
                  key={t.turnId}
                  id={`context-turn-${t.turnId}`}
                  className="py-2.5 first:pt-1 last:pb-1"
                >
                  <TurnCard
                    turn={turnRecord}
                    source={source}
                    showSourceBadge={false}
                    isContextTarget={t.isTargetTurn}
                    query={query}
                    mode={mode}
                    activeAudioId={activeAudioPhraseId}
                    onActivateAudio={onActivateAudio}
                    variant="context-drawer"
                    defaultExpanded={true}
                  />
                </div>
              );
            })}

          {/* Load Later Button */}
          {contextWindow.hasNext && (
            <div className="pt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setRadiusAfter(prev => prev + (isBible ? 5 : 2))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>{isBible ? 'Later verses' : 'Later turns'}</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
