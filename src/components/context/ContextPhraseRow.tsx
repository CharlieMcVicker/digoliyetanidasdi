import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { PhraseRecord, ScoredPhraseMatch, SearchMode } from '../../types/corpus';
import {
  buildEnglishHighlightRegex,
  buildPhoneticHighlightRegex,
} from '../../lib/search';
import { renderHighlightedToken } from '../../lib/highlight';
import {
  getRowConfidenceFlair,
  getWordHighlightClasses,
} from '../../lib/confidence';

export interface ContextPhraseRowProps {
  phrase: PhraseRecord | ScoredPhraseMatch;
  partLabel?: string;
  showEnglishAtBottom: boolean;
  isContextTarget: boolean;
  query: string;
  mode: SearchMode;
  isActiveAudio: boolean;
  onActivateAudio: (phraseId: string) => void;
}

export const ContextPhraseRow: React.FC<ContextPhraseRowProps> = ({
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
                    ? `Click to play word "${wMeta.word}" (${wMeta.start.toFixed(2)}s – ${wMeta.end.toFixed(2)}s)`
                    : 'Click to play word'
                }
                className={`inline-block cursor-pointer select-none touch-manipulation rounded px-1 py-0.2 transition-colors ${
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
                    ? `Click to play word "${wMeta.word}" (${wMeta.start.toFixed(2)}s – ${wMeta.end.toFixed(2)}s)`
                    : 'Click to play word'
                }
                className={`inline-block cursor-pointer select-none touch-manipulation rounded px-1 py-0.2 transition-colors ${
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
