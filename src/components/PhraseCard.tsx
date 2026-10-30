import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Pause,
  Play,
  Volume2,
} from 'lucide-react';
import type { ScoredPhraseMatch, SearchMode } from '../types/corpus';
import {
  buildEnglishHighlightRegex,
  buildPhoneticHighlightRegex,
} from '../lib/search';

interface PhraseCardProps {
  phrase: ScoredPhraseMatch;
  query: string;
  mode: SearchMode;
  isActiveAudio: boolean;
  onActivateAudio: (phraseId: string) => void;
}

function getConfidenceColorClasses(conf: number, flagged?: boolean) {
  if (flagged || conf < 0.1) {
    return {
      badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
      word: 'bg-rose-500/20 text-rose-100 border-rose-500/50 ring-1 ring-rose-500/30',
      label: 'Low',
    };
  }
  if (conf < 0.8) {
    return {
      badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      word: 'bg-amber-500/20 text-amber-100 border-amber-500/50 ring-1 ring-amber-500/30',
      label: 'Mid',
    };
  }
  return {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    word: 'bg-emerald-500/20 text-emerald-100 border-emerald-500/50 ring-1 ring-emerald-500/30',
    label: 'High',
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
          className="bg-sky-400/35 text-white font-semibold rounded px-0.5 underline decoration-sky-400 decoration-2 underline-offset-2"
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
  query,
  mode,
  isActiveAudio,
  onActivateAudio,
}) => {
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(phrase.audio_end || 0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [activeWordIdx, setActiveWordIdx] = useState<number>(-1);

  const phoneticTokens = phrase.phonetic_text.split(/\s+/).filter(Boolean);
  const syllabaryTokens = phrase.syllabary_text.split(/\s+/).filter(Boolean);
  const matchedSet = new Set(phrase.matchedWordIndices);

  const phoneticRegex =
    phrase.matchType !== 'english' ? buildPhoneticHighlightRegex(query, mode) : null;
  const englishRegex =
    phrase.matchType === 'english' ? buildEnglishHighlightRegex(query) : null;

  // Pause if another phrase becomes the active audio player
  useEffect(() => {
    if (!isActiveAudio && wavesurferRef.current && isPlaying) {
      wavesurferRef.current.pause();
      setIsPlaying(false);
      setActiveWordIdx(-1);
    }
  }, [isActiveAudio, isPlaying]);

  // Clean up WaveSurfer on unmount
  useEffect(() => {
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, []);

  const updateActiveWordFromTime = (t: number) => {
    setCurrentTime(t);
    const idx = phrase.words.findIndex(w => t >= w.start && t <= w.end);
    setActiveWordIdx(idx);
  };

  const ensureWaveSurferAndPlay = (seekToSeconds?: number) => {
    onActivateAudio(phrase.id);

    if (wavesurferRef.current && isReady) {
      const ws = wavesurferRef.current;
      if (seekToSeconds !== undefined) {
        ws.setTime(Math.max(0, seekToSeconds));
        updateActiveWordFromTime(seekToSeconds);
        ws.play();
      } else if (ws.isPlaying()) {
        ws.pause();
      } else {
        ws.play();
      }
      return;
    }

    if (seekToSeconds !== undefined) {
      pendingSeekRef.current = seekToSeconds;
    }

    if (!wavesurferRef.current && waveformContainerRef.current) {
      const ws = WaveSurfer.create({
        container: waveformContainerRef.current,
        url: `/${phrase.audio_path}`,
        height: 44,
        waveColor: '#475569',
        progressColor: '#38bdf8',
        cursorColor: '#f8fafc',
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
        if (pendingSeekRef.current !== null) {
          const target = Math.max(0, pendingSeekRef.current);
          pendingSeekRef.current = null;
          ws.setTime(target);
          updateActiveWordFromTime(target);
        }
        ws.play();
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
    ensureWaveSurferAndPlay(w.start);
  };

  const handleSpeedChange = (newRate: number) => {
    setPlaybackRate(newRate);
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(newRate);
    }
  };

  const phraseConfStyle = getConfidenceColorClasses(
    phrase.mean_confidence,
    phrase.has_anomalies && phrase.mean_confidence < 0.25
  );
  const matchedConfStyle = getConfidenceColorClasses(phrase.matchedConfidence);

  const matchBadgeStyle =
    phrase.matchType === 'strict'
      ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
      : phrase.matchType === 'broad'
        ? 'bg-violet-500/15 text-violet-300 border-violet-500/40'
        : 'bg-teal-500/15 text-teal-300 border-teal-500/40';

  return (
    <div
      className={`rounded-xl border transition-all duration-150 p-4 ${
        isActiveAudio
          ? 'bg-slate-900/95 border-sky-500/60 shadow-lg shadow-sky-950/50'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top Meta Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
            {phrase.loc_label}
          </span>

          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${matchBadgeStyle}`}
          >
            {phrase.matchType === 'strict'
              ? 'Strict T/TH'
              : phrase.matchType === 'broad'
                ? 'Broad Phonetic'
                : 'English'}
          </span>

          {phrase.matchType !== 'english' && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-mono font-medium px-2.5 py-0.5 rounded-full border ${matchedConfStyle.badge}`}
              title="Audio alignment confidence of the matched query word(s)"
            >
              <Gauge className="w-3.5 h-3.5" />
              Match Conf: {(phrase.matchedConfidence * 100).toFixed(1)}%
            </span>
          )}
        </div>

        {/* Phrase Confidence Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-full border ${phraseConfStyle.badge}`}
            title={`Phrase Mean Confidence: ${(phrase.mean_confidence * 100).toFixed(1)}% | Min Word Confidence: ${(phrase.min_confidence * 100).toFixed(1)}%`}
          >
            {phrase.has_anomalies ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Phrase Conf: {(phrase.mean_confidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Syllabary Line (1:1 index-aligned with words[]) */}
      <div
        className="text-xl sm:text-2xl leading-relaxed tracking-wide text-slate-100 mb-2 font-medium"
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
                    ? `${wMeta.word} • Conf: ${(wMeta.confidence * 100).toFixed(1)}% (${wMeta.start.toFixed(2)}s – ${wMeta.end.toFixed(2)}s) — Click to play`
                    : 'Click to play'
                }
                className={`inline-block cursor-pointer rounded-md px-1.5 py-0.5 transition-all duration-100 ${
                  isSpeaking
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/40 scale-105'
                    : isMatched && wConfStyle
                      ? `${wConfStyle.word}`
                      : 'hover:bg-slate-800 hover:text-sky-200'
                }`}
              >
                {sylWord}
              </span>{' '}
            </React.Fragment>
          );
        })}
      </div>

      {/* Canonical T/TH Phonetic Line (1:1 index-aligned with words[]) */}
      <div className="font-mono text-sm sm:text-base leading-relaxed text-slate-300 mb-2.5">
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
                    ? `Confidence: ${(wMeta.confidence * 100).toFixed(1)}% (${wMeta.start.toFixed(2)}s – ${wMeta.end.toFixed(2)}s)${wMeta.flagged ? ' [Flagged]' : ''}`
                    : undefined
                }
                className={`inline-flex items-center gap-1 cursor-pointer rounded-md px-1.5 py-0.5 transition-all duration-100 ${
                  isSpeaking
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/40 scale-105'
                    : isMatched && wConfStyle
                      ? `${wConfStyle.word}`
                      : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <span>
                  {isMatched
                    ? renderHighlightedToken(phonWord, phoneticRegex)
                    : phonWord}
                </span>
                {isMatched && wMeta && (
                  <span className="text-[10px] opacity-80 font-sans">
                    {(wMeta.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </span>{' '}
            </React.Fragment>
          );
        })}
      </div>

      {/* English Gloss / Translation */}
      {phrase.english_text && (
        <div className="text-sm text-slate-400 italic mb-3">
          {phrase.matchType === 'english'
            ? renderHighlightedToken(phrase.english_text, englishRegex)
            : phrase.english_text}
        </div>
      )}

      {/* Audio Player & Waveform Bar */}
      <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800/90 rounded-lg px-3 py-2">
        <button
          type="button"
          onClick={() => ensureWaveSurferAndPlay()}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition shadow cursor-pointer shrink-0"
          title={isPlaying ? 'Pause' : 'Play phrase audio'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div
            ref={waveformContainerRef}
            className={`w-full ${isReady ? 'block' : 'hidden'}`}
          />
          {!isReady && (
            <div
              onClick={() => ensureWaveSurferAndPlay()}
              className="h-9 flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none"
            >
              <Volume2 className="w-4 h-4 text-sky-400/70" />
              <span>
                Click Play or any Cherokee word above to load waveform & listen (
                {phrase.audio_end.toFixed(2)}s)
              </span>
            </div>
          )}
        </div>

        <div className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
          {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
        </div>

        <select
          value={playbackRate}
          onChange={e => handleSpeedChange( parseFloat(e.target.value) )}
          aria-label="Playback speed"
          className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded px-1.5 py-1 font-mono focus:outline-none focus:border-sky-500"
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
