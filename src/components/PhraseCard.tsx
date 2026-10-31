import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Info,
  Layers,
  Pause,
  Play,
  Volume2,
} from 'lucide-react';
import type { DocumentMeta, PhraseRecord, ScoredPhraseMatch, SearchMode } from '../types/corpus';
import {
  buildEnglishHighlightRegex,
  buildPhoneticHighlightRegex,
  formatUngroupedSourceLocation,
} from '../lib/search';
import { getConfidenceColorClasses } from '../lib/confidence';
import { renderHighlightedToken } from '../lib/highlight';

export interface PhraseCardProps {
  phrase: PhraseRecord | ScoredPhraseMatch;
  source?: DocumentMeta;
  showSourceBadge?: boolean;
  turnPartInfo?: { phraseIndex: number; turnPhraseCount: number };
  hideEnglishTranslation?: boolean;
  isContextTarget?: boolean;
  onViewInContext?: (phrase: PhraseRecord) => void;
  query: string;
  mode: SearchMode;
  isActiveAudio: boolean;
  onActivateAudio: (phraseId: string) => void;
}

export const PhraseCard: React.FC<PhraseCardProps> = ({
  phrase,
  source,
  showSourceBadge = false,
  turnPartInfo,
  hideEnglishTranslation = false,
  isContextTarget = false,
  onViewInContext,
  query,
  mode,
  isActiveAudio,
  onActivateAudio,
}) => {
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlaybackRef = useRef<{ start?: number; end?: number } | null>(null);
  const stopAtSecondsRef = useRef<number | null>(null);

  const isRemoteAudio =
    phrase.audio_path.startsWith('http://') ||
    phrase.audio_path.startsWith('https://');
  const segmentStart = phrase.audio_start || 0;
  const segmentEnd = phrase.audio_end || 0;
  const segmentDuration = Math.max(
    0,
    isRemoteAudio ? segmentEnd - segmentStart : segmentEnd
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(segmentDuration);
  const [playbackRate, setPlaybackRate] = useState(1.0);
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

  // Pause if another phrase becomes the active audio player
  useEffect(() => {
    if (!isActiveAudio && isPlaying) {
      if (wavesurferRef.current) {
        wavesurferRef.current.pause();
      }
      if (htmlAudioRef.current) {
        htmlAudioRef.current.pause();
      }
      setIsPlaying(false);
      setActiveWordIdx(-1);
    }
  }, [isActiveAudio, isPlaying]);

  // Clean up WaveSurfer / HTMLAudioElement on unmount
  useEffect(() => {
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      if (htmlAudioRef.current) {
        htmlAudioRef.current.pause();
        htmlAudioRef.current.src = '';
        htmlAudioRef.current = null;
      }
    };
  }, []);

  const updateActiveWordFromTime = (t: number) => {
    if (isRemoteAudio) {
      const rel = Math.max(0, Math.min(segmentDuration, t - segmentStart));
      setCurrentTime(rel);
      return;
    }
    setCurrentTime(t);
    const idx = phrase.words.findIndex(w => t >= w.start && t <= w.end);
    setActiveWordIdx(idx);
  };

  const ensureWaveSurferAndPlay = (seekToSeconds?: number, endSeconds?: number) => {
    onActivateAudio(phrase.id);

    if (isRemoteAudio) {
      const targetTime =
        seekToSeconds !== undefined ? Math.max(segmentStart, seekToSeconds) : segmentStart;
      const stopTime =
        endSeconds !== undefined
          ? Math.min(segmentEnd > segmentStart ? segmentEnd : Infinity, endSeconds)
          : null;
      stopAtSecondsRef.current = stopTime;

      if (htmlAudioRef.current) {
        const audio = htmlAudioRef.current;
        if (seekToSeconds !== undefined) {
          audio.currentTime = targetTime;
          setCurrentTime(Math.max(0, targetTime - segmentStart));
          void audio.play();
        } else if (!audio.paused) {
          audio.pause();
        } else {
          if (
            audio.currentTime < segmentStart ||
            (segmentEnd > segmentStart && audio.currentTime >= segmentEnd - 0.05)
          ) {
            audio.currentTime = segmentStart;
            setCurrentTime(0);
          }
          void audio.play();
        }
        return;
      }

      const audio = new Audio(phrase.audio_path);
      audio.preload = 'metadata';
      audio.playbackRate = playbackRate;

      audio.addEventListener('loadedmetadata', () => {
        setIsReady(true);
        audio.currentTime = targetTime;
        setCurrentTime(Math.max(0, targetTime - segmentStart));
        void audio.play();
      });

      audio.addEventListener('timeupdate', () => {
        if (stopAtSecondsRef.current !== null && audio.currentTime >= stopAtSecondsRef.current) {
          audio.pause();
          stopAtSecondsRef.current = null;
          setIsPlaying(false);
          return;
        }
        if (segmentEnd > segmentStart && audio.currentTime >= segmentEnd) {
          audio.pause();
          audio.currentTime = segmentStart;
          setIsPlaying(false);
          setCurrentTime(segmentDuration);
          return;
        }
        updateActiveWordFromTime(audio.currentTime);
      });

      audio.addEventListener('play', () => {
        setIsPlaying(true);
        const checkStop = () => {
          if (htmlAudioRef.current && !htmlAudioRef.current.paused) {
            if (
              stopAtSecondsRef.current !== null &&
              htmlAudioRef.current.currentTime >= stopAtSecondsRef.current
            ) {
              htmlAudioRef.current.pause();
              stopAtSecondsRef.current = null;
              setIsPlaying(false);
              return;
            }
            requestAnimationFrame(checkStop);
          }
        };
        if (stopAtSecondsRef.current !== null) {
          requestAnimationFrame(checkStop);
        }
      });
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });

      htmlAudioRef.current = audio;
      audio.load();
      return;
    }

    const safePlay = (ws: WaveSurfer, start?: number, end?: number) => {
      try {
        let p: Promise<void> | undefined;
        if (start !== undefined && end !== undefined) {
          p = ws.play(Math.max(0, start), Math.max(start, end));
        } else if (start !== undefined) {
          const target = Math.max(0, start);
          ws.setTime(target);
          updateActiveWordFromTime(target);
          p = ws.play();
        } else {
          p = ws.play();
        }
        if (p && typeof p.catch === 'function') {
          p.catch(err => {
            console.warn('Playback prevented or interrupted:', err);
            setIsPlaying(false);
          });
        }
      } catch (err) {
        console.warn('Playback call failed:', err);
        setIsPlaying(false);
      }
    };

    if (wavesurferRef.current && isReady) {
      const ws = wavesurferRef.current;
      if (seekToSeconds !== undefined) {
        safePlay(ws, seekToSeconds, endSeconds);
      } else if (ws.isPlaying()) {
        ws.pause();
      } else {
        if (ws.getCurrentTime() >= (duration > 0 ? duration - 0.05 : 0)) {
          ws.setTime(0);
        }
        safePlay(ws);
      }
      return;
    }

    if (seekToSeconds !== undefined) {
      pendingPlaybackRef.current = { start: seekToSeconds, end: endSeconds };
    } else {
      pendingPlaybackRef.current = null;
    }

    if (!wavesurferRef.current && waveformContainerRef.current) {
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const audioUrl = `${base}/${phrase.audio_path.replace(/^\/+/, '')}`;
      const ws = WaveSurfer.create({
        container: waveformContainerRef.current,
        url: audioUrl,
        height: 44,
        waveColor: '#94a3b8',
        progressColor: '#0284c7',
        cursorColor: '#0f172a',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      });

      ws.on('ready', () => {
        setIsReady(true);
        const d = ws.getDuration();
        if (d > 0) setDuration(d);
        ws.setPlaybackRate(playbackRate);
        if (pendingPlaybackRef.current !== null) {
          const { start, end } = pendingPlaybackRef.current;
          pendingPlaybackRef.current = null;
          safePlay(ws, start, end);
        } else {
          safePlay(ws);
        }
      });

      ws.on('error', (err: unknown) => {
        console.error('WaveSurfer error on phrase:', phrase.id, err);
        setIsReady(false);
        setIsPlaying(false);
      });

      ws.on('timeupdate', (t: number) => {
        updateActiveWordFromTime(t);
      });

      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => {
        setIsPlaying(false);
        setActiveWordIdx(-1);
      });

      wavesurferRef.current = ws;
    }
  };

  const handleWordClick = (wordIdx: number) => {
    const w = phrase.words[wordIdx];
    if (!w) return;
    setActiveWordIdx(wordIdx);
    const endSec = Math.max(w.start + 0.05, w.end);
    ensureWaveSurferAndPlay(w.start, endSec);
  };

  const handleSpeedChange = (newRate: number) => {
    setPlaybackRate(newRate);
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(newRate);
    }
    if (htmlAudioRef.current) {
      htmlAudioRef.current.playbackRate = newRate;
    }
  };

  const displayConf =
    scoredMatch && scoredMatch.matchType !== 'english'
      ? scoredMatch.matchedConfidence
      : phrase.mean_confidence;
  const activeQualityStyle = getConfidenceColorClasses(
    displayConf,
    phrase.has_anomalies && displayConf < 0.25
  );

  const effectivePartIndex = turnPartInfo?.phraseIndex ?? phrase.phrase_index ?? 1;
  const effectivePartTotal = turnPartInfo?.turnPhraseCount ?? phrase.turn_phrase_count ?? 1;
  const isMultiPartTurn = effectivePartTotal > 1;

  const isOrderedSource =
    source &&
    (source.source_type === 'biblical_chapter' ||
      source.source_type === 'marked_syllabary_corpus');

  const ungroupedMeta = showSourceBadge
    ? formatUngroupedSourceLocation(source, phrase)
    : null;

  return (
    <div
      id={`phrase-card-${phrase.id}`}
      className={`rounded-xl border transition-all duration-150 p-3.5 sm:p-5 ${
        isActiveAudio
          ? 'bg-sky-50/50 border-sky-500 shadow-md ring-2 ring-sky-500/15'
          : isContextTarget
            ? 'bg-sky-50/35 border-sky-400 shadow-xs ring-2 ring-sky-500/10'
            : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
      }`}
    >
      {/* Top Meta Row */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 mb-2.5 sm:mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {ungroupedMeta ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
              <span className="text-sky-800">{ungroupedMeta.sourceLabel}</span>
              <span className="text-slate-400">•</span>
              <span className="font-mono text-slate-700">{ungroupedMeta.locLabel}</span>
            </span>
          ) : (
            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              {phrase.loc_label}
            </span>
          )}

          {isMultiPartTurn && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-violet-50 text-violet-800 border border-violet-200"
              title={`Sub-chunk ${effectivePartIndex} of ${effectivePartTotal} within this speaker turn`}
            >
              <Layers className="w-3 h-3 text-violet-600" />
              <span>
                Part {effectivePartIndex} of {effectivePartTotal}
              </span>
            </span>
          )}

          {isContextTarget && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-sky-100 text-sky-900 border border-sky-300">
              Selected Recording
            </span>
          )}
        </div>

        {/* Right Meta: View in Context + Audio Alignment Quality Badge */}
        <div className="flex flex-wrap items-center gap-2">
          {onViewInContext && isOrderedSource && (
            <button
              type="button"
              onClick={() => onViewInContext(phrase)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition cursor-pointer shadow-2xs ${
                isContextTarget
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white hover:bg-sky-50 text-sky-700 hover:text-sky-900 border-slate-200 hover:border-sky-300'
              }`}
              title={
                source.source_type === 'biblical_chapter'
                  ? `View ${source.title} in chapter context`
                  : 'View this phrase inside the full interview turn and surrounding conversation'
              }
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{isContextTarget ? 'Viewing in context' : 'View in context'}</span>
            </button>
          )}

          {isRemoteAudio ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200 cursor-help"
              title={`Plays the full interview turn (${segmentStart.toFixed(1)}s – ${segmentEnd.toFixed(1)}s)`}
            >
              <Volume2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Full Turn Audio</span>
              <Info className="w-3 h-3 opacity-60" />
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border cursor-help ${activeQualityStyle.badge}`}
              title={`${activeQualityStyle.description}\n• Matched word confidence: ${(displayConf * 100).toFixed(1)}%\n• Phrase average confidence: ${(phrase.mean_confidence * 100).toFixed(1)}%`}
            >
              {activeQualityStyle.isLow ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{activeQualityStyle.label}</span>
              <Info className="w-3 h-3 opacity-60" />
            </span>
          )}
        </div>
      </div>

      {/* Syllabary Line (1:1 index-aligned with words[]) */}
      <div
        className="text-xl sm:text-2xl leading-relaxed tracking-wide text-slate-900 mb-2 font-medium"
        style={{
          fontFamily:
            '"Plantagenet Cherokee", "Noto Sans Cherokee", "Apple Symbols", sans-serif',
        }}
      >
        {syllabaryTokens.map((sylWord, idx) => {
          const wMeta = phrase.words[idx];
          const isMatched = matchedSet.has(idx);
          const isSpeaking = activeWordIdx === idx;
          const wConfStyle = wMeta
            ? getConfidenceColorClasses(wMeta.confidence, wMeta.flagged)
            : null;

          return (
            <React.Fragment key={idx}>
              <span
                data-word-idx={idx}
                role="button"
                tabIndex={0}
                onClick={() => handleWordClick(idx)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleWordClick(idx);
                  }
                }}
                title={
                  wMeta
                    ? isRemoteAudio
                    ? `Click to play (${wMeta.start.toFixed(1)}s – ${wMeta.end.toFixed(1)}s)`
                    : `Click to play word "${wMeta.word}" (${wMeta.start.toFixed(2)}s – ${wMeta.end.toFixed(2)}s) • Alignment confidence: ${(wMeta.confidence * 100).toFixed(1)}%`
                    : 'Click to play'
                }
                className={`inline-block cursor-pointer select-none touch-manipulation rounded-md px-1.5 py-0.5 transition-all duration-100 ${
                  isSpeaking
                    ? 'bg-sky-600 text-white font-bold shadow-xs scale-105'
                    : isMatched && wConfStyle
                      ? `${wConfStyle.word}`
                      : 'hover:bg-slate-100 text-slate-900'
                }`}
              >
                {sylWord}
              </span>{' '}
            </React.Fragment>
          );
        })}
      </div>

      {/* Phonetic Line (1:1 index-aligned with words[]) */}
      <div className="font-mono text-sm sm:text-base leading-relaxed text-slate-700 mb-2.5">
        {phoneticTokens.map((phonWord, idx) => {
          const wMeta = phrase.words[idx];
          const isMatched = matchedSet.has(idx);
          const isSpeaking = activeWordIdx === idx;
          const wConfStyle = wMeta
            ? getConfidenceColorClasses(wMeta.confidence, wMeta.flagged)
            : null;

          return (
            <React.Fragment key={idx}>
              <span
                data-word-idx={idx}
                role="button"
                tabIndex={0}
                onClick={() => handleWordClick(idx)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleWordClick(idx);
                  }
                }}
                title={
                  wMeta
                    ? isRemoteAudio
                    ? `Click to play (${wMeta.start.toFixed(1)}s – ${wMeta.end.toFixed(1)}s)`
                    : `Click to play word "${wMeta.word}" (${wMeta.start.toFixed(2)}s – ${wMeta.end.toFixed(2)}s) • Alignment confidence: ${(wMeta.confidence * 100).toFixed(1)}%`
                    : undefined
                }
                className={`inline-flex items-center gap-1 cursor-pointer select-none touch-manipulation rounded-md px-1.5 py-0.5 transition-all duration-100 ${
                  isSpeaking
                    ? 'bg-sky-600 text-white font-bold shadow-xs scale-105'
                    : isMatched && wConfStyle
                      ? `${wConfStyle.word}`
                      : 'hover:bg-slate-100 text-slate-700 hover:text-slate-950'
                }`}
              >
                <span>
                  {isMatched
                    ? renderHighlightedToken(phonWord, phoneticRegex)
                    : phonWord}
                </span>
              </span>{' '}
            </React.Fragment>
          );
        })}
      </div>

      {/* English Gloss / Translation */}
      {!hideEnglishTranslation && phrase.english_text && (
        <div className="text-sm text-slate-600 italic mb-3">
          {scoredMatch && scoredMatch.matchType === 'english'
            ? renderHighlightedToken(phrase.english_text, englishRegex)
            : phrase.english_text}
        </div>
      )}

      {/* Audio Player & Waveform Bar */}
      <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 border border-slate-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
        <button
          type="button"
          onClick={() => ensureWaveSurferAndPlay()}
          className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-bold transition shadow-xs cursor-pointer shrink-0"
          title={isPlaying ? 'Pause' : 'Play phrase audio'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {isRemoteAudio ? (
            <div
              onClick={e => {
                if (segmentDuration <= 0) {
                  ensureWaveSurferAndPlay();
                  return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(
                  0,
                  Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))
                );
                ensureWaveSurferAndPlay(segmentStart + ratio * segmentDuration);
              }}
              className="h-9 flex flex-col justify-center gap-1.5 cursor-pointer select-none"
              title="Click to play or seek within remote interview segment"
            >
              <div className="flex items-center justify-between text-xs text-slate-600 gap-2">
                <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                  <Volume2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span className="truncate">
                    {isReady
                      ? 'Streaming remote segment audio'
                      : `Click Play to stream (${segmentDuration.toFixed(1)}s)`}
                  </span>
                </span>
                <span className="font-mono text-[10px] sm:text-[11px] text-slate-500 shrink-0">
                  {segmentStart.toFixed(1)}s – {segmentEnd.toFixed(1)}s
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-600 transition-all duration-100"
                  style={{
                    width: `${
                      segmentDuration > 0
                        ? Math.min(100, (currentTime / segmentDuration) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <div
                ref={waveformContainerRef}
                className={`w-full ${isReady ? 'block' : 'hidden'}`}
              />
              {!isReady && (
                <div
                  onClick={() => ensureWaveSurferAndPlay()}
                  className="h-9 flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 cursor-pointer select-none min-w-0"
                >
                  <Volume2 className="w-4 h-4 text-sky-600 shrink-0" />
                  <span className="truncate">
                    Click Play or word to load waveform & listen ({segmentDuration.toFixed(1)}s)
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="font-mono text-[11px] sm:text-xs text-slate-500 tabular-nums shrink-0">
          {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
        </div>

        <select
          value={playbackRate}
          onChange={e => handleSpeedChange( parseFloat(e.target.value) )}
          aria-label="Playback speed"
          className="bg-white border border-slate-300 text-slate-700 text-[11px] sm:text-xs rounded px-1 sm:px-1.5 py-1 font-mono focus:outline-none focus:border-sky-500"
        >
          <option value={0.5}>0.5x</option>
          <option value={0.75}>0.75x</option>
          <option value={1}>1.0x</option>
          <option value={1.25}>1.25x</option>
        </select>
      </div>
    </div>
  );
};
