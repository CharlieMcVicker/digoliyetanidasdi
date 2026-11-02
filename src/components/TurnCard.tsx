import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Gauge,
  Pause,
  Play,
} from 'lucide-react';
import type {
  DocumentMeta,
  PhraseRecord,
  ScoredTurnMatch,
  SearchMode,
  TurnRecord,
} from '../types/corpus';
import {
  buildEnglishHighlightRegex,
  buildPhoneticHighlightRegex,
  computeWordTurnTime,
  formatUngroupedSourceLocation,
} from '../lib/search';
import { getRowConfidenceFlair } from '../lib/confidence';
import { renderHighlightedToken } from '../lib/highlight';
import { formatTimeRange } from '../lib/format';

export interface TurnCardProps {
  turn: TurnRecord | ScoredTurnMatch;
  source?: DocumentMeta;
  showSourceBadge?: boolean;
  query?: string;
  mode?: SearchMode;
  isContextTarget?: boolean;
  onViewInContext?: (phrase: PhraseRecord) => void;
  activeAudioId: string | null;
  onActivateAudio: (id: string) => void;
  variant?: 'search-result' | 'context-drawer';
  defaultExpanded?: boolean;
}

const PLAYBACK_SPEEDS = [1.0, 0.9, 0.8];

export const TurnCard: React.FC<TurnCardProps> = ({
  turn,
  source,
  showSourceBadge = false,
  query = '',
  mode = 'english',
  isContextTarget = false,
  onViewInContext,
  activeAudioId,
  onActivateAudio,
  variant = 'search-result',
  defaultExpanded,
}) => {
  const isMultiPart = turn.phrases.length > 1;
  const isContextVariant = variant === 'context-drawer';
  const initiallyExpanded =
    defaultExpanded !== undefined
      ? defaultExpanded
      : isContextVariant || turn.phrases.length <= 3;

  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [activeWordInfo, setActiveWordInfo] = useState<{
    phraseId: string;
    wordIndex: number;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isAudioActive = activeAudioId === turn.id;

  const isRemoteAudio =
    Boolean(turn.turn_audio_path?.startsWith('http://')) ||
    Boolean(turn.turn_audio_path?.startsWith('https://'));

  const turnStartSec = turn.turn_start_sec ?? 0;
  const turnEndSec = turn.turn_end_sec ?? turnStartSec;
  const durationSec = Math.max(
    0.1,
    turn.duration_sec || turnEndSec - turnStartSec
  );

  const playbackRate = PLAYBACK_SPEEDS[speedIndex];

  // Pause playback if another audio item activates
  useEffect(() => {
    if (!isAudioActive && isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setActiveWordInfo(null);
    }
  }, [isAudioActive, isPlaying]);

  // Clean up audio element on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // Monitor playback currentTime and highlight the currently spoken word
  const startMonitoringLoop = (audio: HTMLAudioElement) => {
    const tick = () => {
      if (!audio || audio.paused) return;

      const rawTime = audio.currentTime;
      const turnRelativeTime = isRemoteAudio
        ? rawTime - turnStartSec
        : rawTime;

      setCurrentTimeSec(Math.max(0, turnRelativeTime));

      // Check remote bounds
      if (isRemoteAudio && turnEndSec > turnStartSec && rawTime >= turnEndSec) {
        audio.pause();
        setIsPlaying(false);
        setActiveWordInfo(null);
        setCurrentTimeSec(0);
        return;
      }

      // Live word karaoke detection across all subchunks in the turn
      let foundWord: { phraseId: string; wordIndex: number } | null = null;
      for (const phrase of turn.phrases) {
        const pOffset =
          phrase.turn_start_sec !== undefined && phrase.global_start_sec !== undefined
            ? Math.max(0, phrase.global_start_sec - phrase.turn_start_sec)
            : 0;

        for (let wIdx = 0; wIdx < phrase.words.length; wIdx++) {
          const w = phrase.words[wIdx];
          const wStart = pOffset + w.start;
          const wEnd = pOffset + w.end;
          if (turnRelativeTime >= wStart && turnRelativeTime <= wEnd) {
            foundWord = { phraseId: phrase.id, wordIndex: wIdx };
            break;
          }
        }
        if (foundWord) break;
      }

      setActiveWordInfo(foundWord);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  const playTurnAtOffset = (seekSec: number = 0) => {
    onActivateAudio(turn.id);

    if (!turn.turn_audio_path) return;

    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const url = isRemoteAudio
      ? turn.turn_audio_path
      : `${base}/${turn.turn_audio_path.replace(/^\/+/, '')}`;

    if (!audioRef.current) {
      const a = new Audio(url);
      a.preload = 'metadata';
      a.playbackRate = playbackRate;

      a.addEventListener('loadedmetadata', () => {
        const initialSeek = isRemoteAudio ? turnStartSec + seekSec : seekSec;
        a.currentTime = Math.max(0, initialSeek);
        void a.play();
      });

      a.addEventListener('play', () => {
        setIsPlaying(true);
        startMonitoringLoop(a);
      });

      a.addEventListener('pause', () => {
        setIsPlaying(false);
      });

      a.addEventListener('ended', () => {
        setIsPlaying(false);
        setActiveWordInfo(null);
        setCurrentTimeSec(0);
      });

      audioRef.current = a;
      a.load();
      return;
    }

    const a = audioRef.current;
    a.playbackRate = playbackRate;

    const targetTime = isRemoteAudio ? turnStartSec + seekSec : seekSec;
    a.currentTime = Math.max(0, targetTime);

    if (a.paused) {
      void a.play();
    }
  };

  const togglePlayPause = () => {
    if (!turn.turn_audio_path) return;

    if (audioRef.current) {
      const a = audioRef.current;
      if (!a.paused) {
        a.pause();
        setIsPlaying(false);
      } else {
        onActivateAudio(turn.id);
        a.playbackRate = playbackRate;
        if (
          isRemoteAudio &&
          (a.currentTime < turnStartSec ||
            (turnEndSec > turnStartSec && a.currentTime >= turnEndSec - 0.05))
        ) {
          a.currentTime = turnStartSec;
        }
        void a.play();
      }
      return;
    }

    playTurnAtOffset(0);
  };

  const handleWordClick = (phrase: PhraseRecord, wordIdx: number) => {
    const w = phrase.words[wordIdx];
    if (!w) return;
    const { startSec } = computeWordTurnTime(phrase, w);
    playTurnAtOffset(startSec);
  };

  const handleCycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (speedIndex + 1) % PLAYBACK_SPEEDS.length;
    setSpeedIndex(nextIdx);
    const nextSpeed = PLAYBACK_SPEEDS[nextIdx];
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTimeSec(val);
    playTurnAtOffset(val);
  };

  // Text highlights
  const englishRegex =
    query.trim() && mode === 'english'
      ? buildEnglishHighlightRegex(query)
      : null;
  const phoneticRegex =
    query.trim() && mode !== 'english'
      ? buildPhoneticHighlightRegex(query, mode)
      : null;

  const displayConfidence = turn.mean_confidence;
  const flair = getRowConfidenceFlair(displayConfidence, turn.has_anomalies);

  // Formatted source location labels
  const sourceLocation = showSourceBadge && source
    ? formatUngroupedSourceLocation(source, turn.phrases[0] || (turn as any))
    : null;

  const fmtMinSec = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div
      id={`turn-${turn.id}`}
      className={`rounded-2xl transition-all ${
        isContextVariant
          ? `py-3.5 px-3 border border-slate-200/80 bg-white ${
              isContextTarget
                ? 'ring-2 ring-sky-500 bg-sky-50/50 shadow-sm'
                : 'hover:border-slate-300'
            }`
          : 'bg-white border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* 1. Header Bar: Speaker, Loc label, Duration, Confidence Flair, and Context Button */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Turn Location Pill */}
          <span className="font-mono text-xs font-bold text-slate-800 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
            {turn.turn_id.startsWith('seg-')
              ? `Seg ${turn.turn_id.replace('seg-', '')}`
              : turn.loc_label.split('•')[0].trim()}
          </span>

          {/* Speaker Badge */}
          {turn.speaker_label && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200/80 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>{turn.speaker_label}</span>
            </span>
          )}

          {/* Source Location Badge when ungrouped */}
          {sourceLocation && (
            <span className="text-xs text-slate-500 font-medium">
              {sourceLocation.sourceLabel}
            </span>
          )}

          {/* Time Range Badge */}
          <span className="font-mono text-xs text-slate-400">
            ({formatTimeRange(turnStartSec, turnEndSec)})
          </span>

          {/* Multi-part Indicator */}
          {isMultiPart && (
            <span className="text-[11px] font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
              {turn.phrases.length} parts
            </span>
          )}

          {turn.has_anomalies && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 cursor-help"
              title="Contains audio/text alignment anomalies"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Check audio</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Alignment Confidence Badge */}
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border cursor-help ${flair.pill}`}
            title={`Mean turn alignment confidence: ${(displayConfidence * 100).toFixed(1)}%`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${flair.dot}`} />
            <span>{flair.label}</span>
          </span>

          {/* View in Context Action */}
          {!isContextVariant && onViewInContext && turn.phrases[0] && (
            <button
              type="button"
              onClick={() => onViewInContext(turn.phrases[0])}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-sky-700 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 rounded-lg transition cursor-pointer"
              title="View this turn in full interview context"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>In context</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Full Turn Audio Player Bar */}
      {turn.turn_audio_path && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-2 mb-3">
          {/* Main Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlayPause}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition cursor-pointer shrink-0 shadow-xs ${
              isPlaying
                ? 'bg-sky-600 hover:bg-sky-700 text-white'
                : 'bg-white hover:bg-sky-50 text-sky-700 border border-slate-200'
            }`}
            title={isPlaying ? 'Pause full turn' : 'Play full turn audio'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Scrubber & Time */}
          <div className="flex-1 flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-500 min-w-8">
              {fmtMinSec(currentTimeSec)}
            </span>
            <input
              type="range"
              min={0}
              max={durationSec}
              step={0.05}
              value={currentTimeSec}
              onChange={handleScrubberChange}
              className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
            />
            <span className="font-mono text-[11px] text-slate-400 min-w-8 text-right">
              {fmtMinSec(durationSec)}
            </span>
          </div>

          {/* Speed Toggle */}
          <button
            type="button"
            onClick={handleCycleSpeed}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-mono font-medium rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer shrink-0"
            title="Adjust Cherokee audio playback speed"
          >
            <Gauge className="w-3 h-3 text-slate-400" />
            <span>{playbackRate.toFixed(1)}x</span>
          </button>
        </div>
      )}

      {/* 3. Primary English Translation (Prominent with Search Query Highlighting) */}
      {turn.english_text && (
        <div className="mb-3.5 p-3 rounded-xl bg-sky-50/40 border border-sky-100/80 text-sm sm:text-base text-slate-800 leading-relaxed font-normal">
          {englishRegex
            ? renderHighlightedToken(turn.english_text, englishRegex)
            : turn.english_text}
        </div>
      )}

      {/* 4. Cherokee Subchunks with Live Karaoke and Click-to-Seek */}
      <div className="border border-slate-100 rounded-xl bg-slate-50/30 overflow-hidden divide-y divide-slate-100">
        {/* Accordion header if multi-part */}
        {isMultiPart && (
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100/80 text-left transition cursor-pointer text-xs font-semibold text-slate-700"
          >
            <div className="flex items-center gap-1.5">
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>Cherokee Utterance ({turn.phrases.length} aligned parts)</span>
              <span className="text-[10px] font-normal text-slate-400">
                • Click any word to listen
              </span>
            </div>
            <span className="text-xs text-sky-700 font-medium">
              {isExpanded ? 'Collapse' : 'Expand all'}
            </span>
          </button>
        )}

        {/* Subchunks list */}
        {(!isMultiPart || isExpanded) &&
          turn.phrases.map((phrase, pIdx) => {
            const isSingle = turn.phrases.length === 1;
            const partLabel = isSingle
              ? undefined
              : `Part ${pIdx + 1}/${turn.phrases.length} (${formatTimeRange(
                  phrase.turn_start_sec !== undefined && phrase.global_start_sec !== undefined
                    ? phrase.global_start_sec - phrase.turn_start_sec
                    : 0,
                  phrase.turn_start_sec !== undefined && phrase.global_end_sec !== undefined
                    ? phrase.global_end_sec - phrase.turn_start_sec
                    : phrase.audio_end || 0
                )})`;

            const sylWords = phrase.syllabary_text.split(/\s+/).filter(Boolean);
            const phonWords = phrase.phonetic_text.split(/\s+/).filter(Boolean);

            return (
              <div
                key={phrase.id}
                id={`context-target-${phrase.id}`}
                className="p-3 sm:px-4 transition-colors hover:bg-slate-50/70"
              >
                {/* Part Header if multi-part */}
                {partLabel && (
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-medium text-slate-500">
                      {partLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const pOffset =
                          phrase.turn_start_sec !== undefined && phrase.global_start_sec !== undefined
                            ? Math.max(0, phrase.global_start_sec - phrase.turn_start_sec)
                            : 0;
                        playTurnAtOffset(pOffset);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-800 transition cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Play part</span>
                    </button>
                  </div>
                )}

                {/* Cherokee Syllabary Line with Live Karaoke Highlighting */}
                <div
                  className="text-base sm:text-lg leading-snug tracking-wide text-slate-900 font-medium select-none"
                  style={{
                    fontFamily:
                      '"Plantagenet Cherokee", "Noto Sans Cherokee", "Apple Symbols", sans-serif',
                  }}
                >
                  {sylWords.map((sylWord, wIdx) => {
                    const isSpeaking =
                      activeWordInfo?.phraseId === phrase.id &&
                      activeWordInfo?.wordIndex === wIdx;
                    const wMeta = phrase.words[wIdx];

                    return (
                      <React.Fragment key={wIdx}>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => handleWordClick(phrase, wIdx)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleWordClick(phrase, wIdx);
                            }
                          }}
                          title={
                            wMeta
                              ? `Click to seek "${wMeta.word}" (${(
                                  (phrase.turn_start_sec !== undefined && phrase.global_start_sec !== undefined
                                    ? phrase.global_start_sec - phrase.turn_start_sec
                                    : 0) + wMeta.start
                                ).toFixed(2)}s)`
                              : 'Click to seek word'
                          }
                          className={`inline-block cursor-pointer rounded px-1 py-0.5 transition-all ${
                            isSpeaking
                              ? 'bg-amber-300 text-amber-950 font-bold ring-2 ring-amber-400/80 shadow-xs scale-105'
                              : 'hover:bg-sky-100 hover:text-sky-900 text-slate-900'
                          }`}
                        >
                          {sylWord}
                        </span>{' '}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Phonetic Line */}
                <div className="font-mono text-xs sm:text-sm leading-snug text-slate-600 mt-1 select-none">
                  {phonWords.map((phonWord, wIdx) => {
                    const isSpeaking =
                      activeWordInfo?.phraseId === phrase.id &&
                      activeWordInfo?.wordIndex === wIdx;
                    const wMeta = phrase.words[wIdx];

                    return (
                      <React.Fragment key={wIdx}>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => handleWordClick(phrase, wIdx)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleWordClick(phrase, wIdx);
                            }
                          }}
                          title={
                            wMeta
                              ? `Click to seek "${wMeta.word}" (${(
                                  (phrase.turn_start_sec !== undefined && phrase.global_start_sec !== undefined
                                    ? phrase.global_start_sec - phrase.turn_start_sec
                                    : 0) + wMeta.start
                                ).toFixed(2)}s)`
                              : 'Click to seek word'
                          }
                          className={`inline-block cursor-pointer rounded px-1 py-0.5 transition-all ${
                            isSpeaking
                              ? 'bg-amber-300 text-amber-950 font-bold ring-2 ring-amber-400/80 shadow-xs'
                              : 'hover:bg-sky-100 hover:text-slate-900 text-slate-600'
                          }`}
                        >
                          {phoneticRegex
                            ? renderHighlightedToken(phonWord, phoneticRegex)
                            : phonWord}
                        </span>{' '}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
