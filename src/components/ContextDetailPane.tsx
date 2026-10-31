import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Pause,
  Play,
  X,
} from 'lucide-react';
import type {
  DocumentMeta,
  PhraseRecord,
  ScoredPhraseMatch,
  SearchMode,
  TurnContainerModel,
} from '../types/corpus';
import {
  buildEnglishHighlightRegex,
  buildOrderedSourceContextWindow,
  buildPhoneticHighlightRegex,
} from '../lib/search';

function formatTimeRange(startSec: number, endSec: number): string {
  const fmt = (s: number) => {
    const total = Math.max(0, Math.round(s));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  return `${fmt(startSec)}–${fmt(endSec)}`;
}

function renderHighlightedToken(
  text: string,
  regex: RegExp | null
): React.ReactNode {
  if (!regex || !text) return text;
  const parts = text.split(regex);
  if (parts.length <= 1) return text;

  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return (
        <mark
          key={idx}
          className="bg-sky-100 text-sky-950 font-semibold rounded px-0.5 underline decoration-sky-500 decoration-2 underline-offset-2"
        >
          {part}
        </mark>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function getWordHighlightClasses(conf: number, flagged?: boolean): string {
  if (flagged || conf < 0.1) {
    return 'bg-rose-100/90 text-rose-950 underline decoration-rose-400';
  }
  if (conf < 0.8) {
    return 'bg-amber-100/90 text-amber-950 underline decoration-amber-400';
  }
  return 'bg-emerald-100/90 text-emerald-950 underline decoration-emerald-500';
}

function getRowConfidenceFlair(conf: number, flagged?: boolean) {
  if (flagged || conf < 0.1) {
    return {
      pill: 'bg-rose-50 text-rose-800 border-rose-200',
      dot: 'bg-rose-500',
      label: 'Uncertain timing',
    };
  }
  if (conf < 0.8) {
    return {
      pill: 'bg-amber-50 text-amber-900 border-amber-200',
      dot: 'bg-amber-500',
      label: 'Approximate',
    };
  }
  return {
    pill: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Clear match',
  };
}

interface FullTurnAudioButtonProps {
  turnId: string;
  audioPath: string;
  startSec: number;
  endSec: number;
  activeAudioId: string | null;
  onActivateAudio: (id: string) => void;
}

const FullTurnAudioButton: React.FC<FullTurnAudioButtonProps> = ({
  turnId,
  audioPath,
  startSec,
  endSec,
  activeAudioId,
  onActivateAudio,
}) => {
  const playerKey = `full-turn-${turnId}`;
  const isActive = activeAudioId === playerKey;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const isRemote =
    audioPath.startsWith('http://') || audioPath.startsWith('https://');
  const duration = Math.max(0, endSec - startSec);

  useEffect(() => {
    if (!isActive && isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActive, isPlaying]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    onActivateAudio(playerKey);

    if (audioRef.current) {
      const a = audioRef.current;
      if (!a.paused) {
        a.pause();
      } else {
        if (
          isRemote &&
          (a.currentTime < startSec ||
            (endSec > startSec && a.currentTime >= endSec - 0.05))
        ) {
          a.currentTime = startSec;
        }
        void a.play();
      }
      return;
    }

    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const url = isRemote ? audioPath : `${base}/${audioPath.replace(/^\/+/, '')}`;
    const a = new Audio(url);
    a.preload = 'metadata';

    a.addEventListener('loadedmetadata', () => {
      if (isRemote && startSec > 0) {
        a.currentTime = startSec;
      }
      void a.play();
    });

    a.addEventListener('timeupdate', () => {
      if (isRemote && endSec > startSec && a.currentTime >= endSec) {
        a.pause();
        a.currentTime = startSec;
        setIsPlaying(false);
      }
    });

    a.addEventListener('play', () => setIsPlaying(true));
    a.addEventListener('pause', () => setIsPlaying(false));
    a.addEventListener('ended', () => setIsPlaying(false));

    audioRef.current = a;
    a.load();
  };

  return (
    <button
      type="button"
      onClick={togglePlay}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border transition cursor-pointer ${
        isPlaying
          ? 'bg-sky-600 text-white border-sky-600'
          : 'bg-white hover:bg-sky-50 text-sky-700 border-slate-200 hover:border-sky-300'
      }`}
      title={`Play full turn (${duration.toFixed(1)}s)`}
    >
      {isPlaying ? (
        <Pause className="w-3 h-3 fill-current" />
      ) : (
        <Play className="w-3 h-3 fill-current" />
      )}
      <span>{isPlaying ? 'Pause Turn' : 'Play Turn'}</span>
    </button>
  );
};

interface ContextPhraseRowProps {
  phrase: PhraseRecord | ScoredPhraseMatch;
  partLabel?: string;
  showEnglishAtBottom: boolean;
  isContextTarget: boolean;
  query: string;
  mode: SearchMode;
  isActiveAudio: boolean;
  onActivateAudio: (phraseId: string) => void;
}

const ContextPhraseRow: React.FC<ContextPhraseRowProps> = ({
  phrase,
  partLabel,
  showEnglishAtBottom,
  isContextTarget,
  query,
  mode,
  isActiveAudio,
  onActivateAudio,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtSecondsRef = useRef<number | null>(null);

  const isRemoteAudio =
    phrase.audio_path.startsWith('http://') ||
    phrase.audio_path.startsWith('https://');
  const segmentStart = phrase.audio_start || 0;
  const segmentEnd = phrase.audio_end || 0;

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWordIdx, setActiveWordIdx] = useState<number>(-1);

  const phoneticTokens = phrase.phonetic_text.split(/\s+/).filter(Boolean);
  const syllabaryTokens = phrase.syllabary_text.split(/\s+/).filter(Boolean);
  const scoredMatch = 'matchType' in phrase ? phrase : null;
  const matchedSet = new Set(scoredMatch ? scoredMatch.matchedWordIndices : []);

  const phoneticRegex =
    scoredMatch && scoredMatch.matchType !== 'english'
      ? buildPhoneticHighlightRegex(query, mode)
      : null;
  const englishRegex =
    scoredMatch && scoredMatch.matchType === 'english'
      ? buildEnglishHighlightRegex(query)
      : null;

  useEffect(() => {
    if (!isActiveAudio && isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setActiveWordIdx(-1);
    }
  }, [isActiveAudio, isPlaying]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const playSegment = (seekToSeconds?: number, endSeconds?: number) => {
    onActivateAudio(phrase.id);

    const minStart = isRemoteAudio ? segmentStart : 0;
    const maxEnd =
      isRemoteAudio && segmentEnd > segmentStart ? segmentEnd : Infinity;

    const targetStart =
      seekToSeconds !== undefined ? Math.max(minStart, seekToSeconds) : minStart;
    const targetEnd =
      endSeconds !== undefined
        ? Math.min(maxEnd, endSeconds)
        : isRemoteAudio && segmentEnd > segmentStart
          ? segmentEnd
          : null;

    stopAtSecondsRef.current = targetEnd;

    const startMonitorLoop = (audio: HTMLAudioElement) => {
      const tick = () => {
        if (!audio || audio.paused) return;
        const t = audio.currentTime;

        if (stopAtSecondsRef.current !== null && t >= stopAtSecondsRef.current) {
          audio.pause();
          stopAtSecondsRef.current = null;
          setIsPlaying(false);
          setActiveWordIdx(-1);
          return;
        }

        if (!isRemoteAudio) {
          const idx = phrase.words.findIndex(w => t >= w.start && t <= w.end);
          setActiveWordIdx(idx);
        }

        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (audioRef.current) {
      const a = audioRef.current;
      if (seekToSeconds !== undefined) {
        a.currentTime = targetStart;
        void a.play();
      } else if (!a.paused) {
        a.pause();
      } else {
        if (
          a.currentTime < minStart ||
          (targetEnd !== null && a.currentTime >= targetEnd - 0.05) ||
          (a.duration && a.currentTime >= a.duration - 0.05)
        ) {
          a.currentTime = minStart;
        }
        void a.play();
      }
      return;
    }

    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const url = isRemoteAudio ? phrase.audio_path : `${base}/${phrase.audio_path.replace(/^\/+/, '')}`;
    const a = new Audio(url);
    a.preload = 'metadata';

    a.addEventListener('loadedmetadata', () => {
      a.currentTime = targetStart;
      void a.play();
    });

    a.addEventListener('play', () => {
      setIsPlaying(true);
      startMonitorLoop(a);
    });

    a.addEventListener('pause', () => {
      setIsPlaying(false);
      if (stopAtSecondsRef.current === null) {
        setActiveWordIdx(-1);
      }
    });

    a.addEventListener('ended', () => {
      setIsPlaying(false);
      setActiveWordIdx(-1);
      stopAtSecondsRef.current = null;
    });

    audioRef.current = a;
    a.load();
  };

  const handleWordClick = (wordIdx: number) => {
    const w = phrase.words[wordIdx];
    if (!w) return;
    setActiveWordIdx(wordIdx);
    const endSec = Math.max(w.start + 0.05, w.end);
    playSegment(w.start, endSec);
  };

  // Extract concise location (e.g. "1:2" or "0:16")
  const shortLoc = partLabel || phrase.loc_label.split('•')[0].trim();
  const displayConf =
    scoredMatch && scoredMatch.matchType !== 'english'
      ? scoredMatch.matchedConfidence
      : phrase.mean_confidence;
  const flair = getRowConfidenceFlair(
    displayConf,
    phrase.has_anomalies && displayConf < 0.25
  );

  return (
    <div
      className={`py-2.5 px-3 transition-colors ${
        isContextTarget
          ? 'bg-sky-50/70 -mx-3 px-3 rounded-lg border-l-3 border-sky-500'
          : ''
      }`}
    >
      {/* Compact Top Bar: Play button + Location/Part label + Confidence Flair */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => playSegment()}
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition cursor-pointer shrink-0 ${
              isPlaying
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 hover:bg-sky-100 text-sky-700 border border-slate-200'
            }`}
            title={isPlaying ? 'Pause phrase' : 'Play phrase'}
          >
            {isPlaying ? (
              <Pause className="w-3 h-3 fill-current" />
            ) : (
              <Play className="w-3 h-3 fill-current ml-0.5" />
            )}
          </button>

          <span className="font-mono text-xs font-semibold text-slate-600">
            {shortLoc}
          </span>

          {isContextTarget && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.2 rounded bg-sky-100 text-sky-800">
              Selected
            </span>
          )}
        </div>

        {/* Compact Confidence Flair */}
        {isRemoteAudio ? (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200 cursor-help"
            title="Full turn audio stream"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            <span>Turn audio</span>
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-help ${flair.pill}`}
            title={`Phrase alignment confidence: ${(phrase.mean_confidence * 100).toFixed(1)}%${
              scoredMatch && scoredMatch.matchType !== 'english'
                ? ` • Matched word: ${(scoredMatch.matchedConfidence * 100).toFixed(1)}%`
                : ''
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${flair.dot}`} />
            <span>{flair.label}</span>
          </span>
        )}
      </div>

      {/* Slightly Smaller Cherokee Syllabary Line */}
      <div
        className="text-base sm:text-lg leading-snug tracking-wide text-slate-900 font-medium"
        style={{
          fontFamily:
            '"Plantagenet Cherokee", "Noto Sans Cherokee", "Apple Symbols", sans-serif',
        }}
      >
        {syllabaryTokens.map((sylWord, idx) => {
          const wMeta = phrase.words[idx];
          const isMatched = matchedSet.has(idx);
          const isSpeaking = activeWordIdx === idx;
          const matchClass =
            isMatched && wMeta
              ? getWordHighlightClasses(wMeta.confidence, wMeta.flagged)
              : '';

          return (
            <React.Fragment key={idx}>
              <span
                data-word-idx={idx}
                onClick={() => handleWordClick(idx)}
                title={
                  wMeta
                    ? `Click to play word "${wMeta.word}" (${wMeta.start.toFixed(2)}s – ${wMeta.end.toFixed(2)}s)`
                    : 'Click to play word'
                }
                className={`inline-block cursor-pointer rounded px-1 py-0.2 transition-colors ${
                  isSpeaking
                    ? 'bg-sky-600 text-white font-bold'
                    : isMatched
                      ? matchClass
                      : 'hover:bg-slate-200/70 text-slate-900'
                }`}
              >
                {sylWord}
              </span>{' '}
            </React.Fragment>
          );
        })}
      </div>

      {/* Slightly Smaller Phonetic Line */}
      <div className="font-mono text-xs sm:text-sm leading-snug text-slate-600 mt-0.5">
        {phoneticTokens.map((phonWord, idx) => {
          const wMeta = phrase.words[idx];
          const isMatched = matchedSet.has(idx);
          const isSpeaking = activeWordIdx === idx;
          const matchClass =
            isMatched && wMeta
              ? getWordHighlightClasses(wMeta.confidence, wMeta.flagged)
              : '';

          return (
            <React.Fragment key={idx}>
              <span
                data-word-idx={idx}
                onClick={() => handleWordClick(idx)}
                title={
                  wMeta
                    ? `Click to play word "${wMeta.word}" (${wMeta.start.toFixed(2)}s – ${wMeta.end.toFixed(2)}s)`
                    : 'Click to play word'
                }
                className={`inline-block cursor-pointer rounded px-1 py-0.2 transition-colors ${
                  isSpeaking
                    ? 'bg-sky-600 text-white font-bold'
                    : isMatched
                      ? matchClass
                      : 'hover:bg-slate-200/70 text-slate-600 hover:text-slate-900'
                }`}
              >
                {isMatched
                  ? renderHighlightedToken(phonWord, phoneticRegex)
                  : phonWord}
              </span>{' '}
            </React.Fragment>
          );
        })}
      </div>

      {/* English Translation at the bottom (for Bible verses or single turns) */}
      {showEnglishAtBottom && phrase.english_text && (
        <div className="text-xs sm:text-sm text-slate-600 italic mt-1.5">
          {scoredMatch && scoredMatch.matchType === 'english'
            ? renderHighlightedToken(phrase.english_text, englishRegex)
            : phrase.english_text}
        </div>
      )}
    </div>
  );
};

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
  turnPartCountsMap,
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
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
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
          className="px-5 py-4 overflow-y-auto flex-1 divide-y divide-slate-200"
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

          {/* Bible Chapter Verses: Clean HR-divided rows with English at the bottom of each verse */}
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

          {/* Saving the Voices Interview Turns: Clean HR-divided turns, sub-chunks separated by subtle HRs, English at the bottom */}
          {contextWindow.kind === 'marked_syllabary_corpus' &&
            contextWindow.turns.map((turn: TurnContainerModel) => {
              const isMultiPart = turn.phrases.length > 1;
              const turnNumMatch = turn.turnId.match(/(\d+)/);
              const turnLabel = turnNumMatch
                ? `Turn ${parseInt(turnNumMatch[1], 10)}`
                : turn.turnId;

              return (
                <div
                  key={turn.turnId}
                  className="py-3.5 first:pt-1 last:pb-1"
                >
                  {/* Turn Header Bar */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {turnLabel} • {turn.speakerLabel}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        ({formatTimeRange(turn.turnStartSec, turn.turnEndSec)})
                      </span>
                    </div>

                    {isMultiPart && turn.turnAudioPath && (
                      <FullTurnAudioButton
                        turnId={`${source.source_id}-${turn.turnId}`}
                        audioPath={turn.turnAudioPath}
                        startSec={turn.turnStartSec}
                        endSec={turn.turnEndSec}
                        activeAudioId={activeAudioPhraseId}
                        onActivateAudio={onActivateAudio}
                      />
                    )}
                  </div>

                  {/* Cherokee Sub-Chunks separated by subtle HRs */}
                  <div className="divide-y divide-slate-100">
                    {turn.phrases.map((subPhrase, idx) => {
                      const scored =
                        scoredMatchesMap.get(subPhrase.id) ?? subPhrase;
                      const isTarget = subPhrase.id === targetPhrase.id;
                      const partInfo = turnPartCountsMap.get(subPhrase.id) ?? {
                        turnId: turn.turnId,
                        phraseIndex: idx + 1,
                        turnPhraseCount: turn.phrases.length,
                      };
                      const timeLabel = subPhrase.loc_label
                        .split('•')[0]
                        .trim();
                      const partLabel = isMultiPart
                        ? `Part ${partInfo.phraseIndex}/${partInfo.turnPhraseCount} • ${timeLabel}`
                        : timeLabel;

                      return (
                        <div
                          key={subPhrase.id}
                          id={
                            isTarget
                              ? `context-target-${subPhrase.id}`
                              : undefined
                          }
                        >
                          <ContextPhraseRow
                            phrase={scored}
                            partLabel={partLabel}
                            showEnglishAtBottom={false}
                            isContextTarget={isTarget}
                            query={query}
                            mode={mode}
                            isActiveAudio={
                              activeAudioPhraseId === subPhrase.id
                            }
                            onActivateAudio={onActivateAudio}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Full Turn English Translation at the bottom */}
                  {turn.englishText && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs sm:text-sm text-slate-600 italic leading-relaxed">
                      {turn.englishText}
                    </div>
                  )}
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
