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

function getConfidenceColorClasses(conf: number, flagged?: boolean) {
  if (flagged || conf < 0.1) {
    return {
      badge: 'bg-rose-50 text-rose-800 border-rose-200',
      word: 'bg-rose-100 text-rose-950 border-rose-300 ring-1 ring-rose-200',
      label: 'Uncertain timing',
      description: 'Machine-generated word timing is uncertain here and may be slightly off',
      isLow: true,
    };
  }
  if (conf < 0.8) {
    return {
      badge: 'bg-amber-50 text-amber-900 border-amber-200',
      word: 'bg-amber-100 text-amber-950 border-amber-300 ring-1 ring-amber-200',
      label: 'Approximate match',
      description: 'Conversational or rapid speech — computer-aligned timing is approximate',
      isLow: false,
    };
  }
  return {
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    word: 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-1 ring-emerald-200',
    label: 'Clear match',
    description: 'Clear computer-generated audio alignment',
    isLow: false,
  };
}

function renderHighlightedToken(text: string, regex: RegExp | null): React.ReactNode {
  if (!regex || !text) return text;
  const parts = text.split(regex);
  if (parts.length <= 1) return text;

  return parts.map((part, idx) => {
    // Because buildPhoneticHighlightRegex / buildEnglishHighlightRegex uses a single outer capturing group,
    // odd indices in split() are the matched substrings!
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

    if (wavesurferRef.current && isReady) {
      const ws = wavesurferRef.current;
      if (seekToSeconds !== undefined) {
        if (endSeconds !== undefined) {
          void ws.play(Math.max(0, seekToSeconds), Math.max(seekToSeconds, endSeconds));
        } else {
          ws.setTime(Math.max(0, seekToSeconds));
          updateActiveWordFromTime(seekToSeconds);
          void ws.play();
        }
      } else if (ws.isPlaying()) {
        ws.pause();
      } else {
        if (ws.getCurrentTime() >= (duration > 0 ? duration - 0.05 : 0)) {
          ws.setTime(0);
        }
        void ws.play();
      }
      return;
    }

    if (seekToSeconds !== undefined) {
      pendingPlaybackRef.current = { start: seekToSeconds, end: endSeconds };
    } else {
      pendingPlaybackRef.current = null;
    }

    if (!wavesurferRef.current && waveformContainerRef.current) {
      const ws = WaveSurfer.create({
        container: waveformContainerRef.current,
        url: `/${phrase.audio_path}`,
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
          if (start !== undefined && end !== undefined) {
            void ws.play(Math.max(0, start), Math.max(start, end));
          } else if (start !== undefined) {
            const target = Math.max(0, start);
            ws.setTime(target);
            updateActiveWordFromTime(target);
            void ws.play();
          } else {
            void ws.play();
          }
        } else {
          void ws.play();
        }
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
      className={`rounded-xl border transition-all duration-150 p-4 ${
        isActiveAudio
          ? 'bg-sky-50/50 border-sky-500 shadow-md ring-2 ring-sky-500/15'
          : isContextTarget
            ? 'bg-sky-50/35 border-sky-400 shadow-xs ring-2 ring-sky-500/10'
            : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
      }`}
    >
      {/* Top Meta Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
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
                onClick={() => handleWordClick(idx)}
                title={
                  wMeta
                    ? isRemoteAudio
                      ? `Click to play (${wMeta.start.toFixed(1)}s – ${wMeta.end.toFixed(1)}s)`
                      : `Click to play word "${wMeta.word}" (${wMeta.start.toFixed(2)}s – ${wMeta.end.toFixed(2)}s) • Alignment confidence: ${(wMeta.confidence * 100).toFixed(1)}%`
                    : 'Click to play'
                }
                className={`inline-block cursor-pointer rounded-md px-1.5 py-0.5 transition-all duration-100 ${
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
                onClick={() => handleWordClick(idx)}
                title={
                  wMeta
                    ? isRemoteAudio
                      ? `Click to play (${wMeta.start.toFixed(1)}s – ${wMeta.end.toFixed(1)}s)`
                      : `Click to play word "${wMeta.word}" (${wMeta.start.toFixed(2)}s – ${wMeta.end.toFixed(2)}s) • Alignment confidence: ${(wMeta.confidence * 100).toFixed(1)}%`
                    : undefined
                }
                className={`inline-flex items-center gap-1 cursor-pointer rounded-md px-1.5 py-0.5 transition-all duration-100 ${
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
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <button
          type="button"
          onClick={() => ensureWaveSurferAndPlay()}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-bold transition shadow-xs cursor-pointer shrink-0"
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
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>
                    {isReady
                      ? 'Streaming remote segment audio'
                      : `Click Play to stream segment (${segmentDuration.toFixed(2)}s)`}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">
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
                  className="h-9 flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 cursor-pointer select-none"
                >
                  <Volume2 className="w-4 h-4 text-sky-600" />
                  <span>
                    Click Play or any Cherokee word above to load waveform & listen (
                    {segmentDuration.toFixed(2)}s)
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
          {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
        </div>

        <select
          value={playbackRate}
          onChange={e => handleSpeedChange( parseFloat(e.target.value) )}
          aria-label="Playback speed"
          className="bg-white border border-slate-300 text-slate-700 text-xs rounded px-1.5 py-1 font-mono focus:outline-none focus:border-sky-500"
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
