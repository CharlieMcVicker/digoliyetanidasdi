import { useEffect, useMemo, useState } from 'react';
import type { DocumentMeta, PhraseRecord } from '../types/corpus';
import {
  buildTurnPartCountsMap,
  createCorpusIndexes,
  type CorpusIndexes,
} from '../lib/search';

export interface CorpusStats {
  totalPhrases: number;
  totalSources: number;
  totalHours: string;
  meanConfidence: string;
}

export interface UseCorpusDataResult {
  sources: DocumentMeta[];
  phrases: PhraseRecord[];
  loading: boolean;
  error: string | null;
  indexes: CorpusIndexes | null;
  phrasesMap: Map<string, PhraseRecord>;
  sourcesMap: Map<string, DocumentMeta>;
  turnPartCountsMap: Map<string, { turnId: string; phraseIndex: number; turnPhraseCount: number }>;
  corpusStats: CorpusStats;
}

const EMPTY_INDEXES: CorpusIndexes = {
  strictPhoneticIndex: null as any,
  broadPhoneticIndex: null as any,
  englishIndex: null as any,
};

export function useCorpusData(): UseCorpusDataResult {
  const [sources, setSources] = useState<DocumentMeta[]>([]);
  const [phrases, setPhrases] = useState<PhraseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        const base = import.meta.env.BASE_URL.replace(/\/$/, '');
        const [sourcesRes, phrasesRes] = await Promise.all([
          fetch(`${base}/data/sources.json`),
          fetch(`${base}/data/phrases.json`),
        ]);
        if (!sourcesRes.ok || !phrasesRes.ok) {
          throw new Error('Failed to load corpus JSON bundles from /data/');
        }
        const [sourcesData, phrasesData] = await Promise.all([
          sourcesRes.json() as Promise<DocumentMeta[]>,
          phrasesRes.json() as Promise<PhraseRecord[]>,
        ]);
        if (!cancelled) {
          setSources(sourcesData);
          setPhrases(phrasesData);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const derived = useMemo(() => {
    const pMap = new Map<string, PhraseRecord>();
    let totalDuration = 0;
    let totalConf = 0;
    let alignedCount = 0;

    for (const p of phrases) {
      pMap.set(p.id, p);
      const isRemote =
        p.audio_path.startsWith('http://') || p.audio_path.startsWith('https://');
      const clipDur = Math.max(
        0,
        isRemote ? (p.audio_end || 0) - (p.audio_start || 0) : p.audio_end || 0
      );
      totalDuration += clipDur;
      if (!isRemote) {
        totalConf += p.mean_confidence || 0;
        alignedCount += 1;
      }
    }

    const sMap = new Map<string, DocumentMeta>();
    for (const s of sources) {
      sMap.set(s.source_id, s);
    }

    const idxs = phrases.length > 0 ? createCorpusIndexes(phrases) : EMPTY_INDEXES;
    const tPartsMap = buildTurnPartCountsMap(phrases);

    return {
      indexes: idxs,
      phrasesMap: pMap,
      sourcesMap: sMap,
      turnPartCountsMap: tPartsMap,
      corpusStats: {
        totalPhrases: phrases.length,
        totalSources: sources.length,
        totalHours: (totalDuration / 3600).toFixed(1),
        meanConfidence: alignedCount
          ? ((totalConf / alignedCount) * 100).toFixed(1)
          : '0.0',
      },
    };
  }, [phrases, sources]);

  return {
    sources,
    phrases,
    loading,
    error,
    indexes: derived.indexes,
    phrasesMap: derived.phrasesMap,
    sourcesMap: derived.sourcesMap,
    turnPartCountsMap: derived.turnPartCountsMap,
    corpusStats: derived.corpusStats,
  };
}
