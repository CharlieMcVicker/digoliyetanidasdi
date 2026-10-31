import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

export interface FullTurnAudioButtonProps {
  turnId: string;
  audioPath: string;
  startSec: number;
  endSec: number;
  activeAudioId: string | null;
  onActivateAudio: (id: string) => void;
}

export const FullTurnAudioButton: React.FC<FullTurnAudioButtonProps> = ({
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
