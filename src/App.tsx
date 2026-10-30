import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Filter,
  Gauge,
  Languages,
  Search,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import type {
  DocumentMeta,
  PhraseRecord,
  SearchMode,
  SortOption,
} from './types/corpus';
import {
  createCorpusIndexes,
  normalizeDGQueryToTTH,
  normalizeTTHQuery,
  searchCorpus,
  toBroadTTH,
} from './lib/search';
import { PhraseCard } from './components/PhraseCard';

const EXAMPLE_QUERIES: Array<{
  label: string;
  query: string;
  mode: SearchMode;
  description: string;
}> = [
  {
    label: 'anichuja',
    query: 'anichuja',
    mode: 'dg',
    description: 'D/G → "anitshutsa" (boys)',
  },
  {
    label: 'adalenisgv',
    query: 'adalenisgv',
    mode: 'dg',
    description: 'D/G → "atalenihskv" (in the beginning)',
  },
  {
    label: 'sgwà:hle̋:sdi',
    query: 'sgwà:hle̋:sdi',
    mode: 'dg',
    description: 'Feeling D/G with tones & colons (ball)',
  },
  {
    label: 'anitshutsa',
    query: 'anitshutsa',
    mode: 'tth',
    description: 'Strict T/TH match',
  },
  {
    label: 'anitsutsa',
    query: 'anitsutsa',
    mode: 'tth',
    description: 'Broad T/TH fallback (without h)',
  },
  {
    label: 'tshutsa tananelo',
    query: 'tshutsa tananelo',
    mode: 'tth',
    description: 'Multi-word infix search',
  },
  {
    label: 'playing ball',
    query: 'playing ball',
    mode: 'english',
    description: 'English gloss search',
  },
  {
    label: 'roosters',
    query: 'roosters',
    mode: 'english',
    description: 'English keyword search',
  },
];

export const App: React.FC = () => {
  const [sources, setSources] = useState<DocumentMeta[]>([]);
  const [phrases, setPhrases] = useState<PhraseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Three exclusive search box states
  const [dgInput, setDgInput] = useState('');
  const [tthInput, setTthInput] = useState('');
  const [englishInput, setEnglishInput] = useState('');
  const [activeMode, setActiveMode] = useState<SearchMode>('dg');

  // Debounced query & mode
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [debouncedMode, setDebouncedMode] = useState<SearchMode>('dg');

  // Sorting & Filtering
  const [sortBy, setSortBy] = useState<SortOption>('matched_confidence');
  const [hideAnomalies, setHideAnomalies] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [activeAudioPhraseId, setActiveAudioPhraseId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        const [sourcesRes, phrasesRes] = await Promise.all([
          fetch('/data/sources.json'),
          fetch('/data/phrases.json'),
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

  const currentRawQuery =
    activeMode === 'dg'
      ? dgInput
      : activeMode === 'tth'
        ? tthInput
        : englishInput;

  // 150ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(currentRawQuery);
      setDebouncedMode(activeMode);
    }, 150);
    return () => clearTimeout(timer);
  }, [currentRawQuery, activeMode]);

  const { indexes, phrasesMap, sourcesMap, corpusStats } = useMemo(() => {
    const pMap = new Map<string, PhraseRecord>();
    let totalDuration = 0;
    let totalConf = 0;
    for (const p of phrases) {
      pMap.set(p.id, p);
      totalDuration += p.audio_end || 0;
      totalConf += p.mean_confidence || 0;
    }

    const sMap = new Map<string, DocumentMeta>();
    for (const s of sources) {
      sMap.set(s.source_id, s);
    }

    const idxs = createCorpusIndexes(phrases);

    return {
      indexes: idxs,
      phrasesMap: pMap,
      sourcesMap: sMap,
      corpusStats: {
        totalPhrases: phrases.length,
        totalSources: sources.length,
        totalHours: (totalDuration / 3600).toFixed(1),
        meanConfidence: phrases.length
          ? ((totalConf / phrases.length) * 100).toFixed(1)
          : '0.0',
      },
    };
  }, [phrases, sources]);

  const groupedResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return searchCorpus(
      debouncedQuery,
      debouncedMode,
      indexes,
      phrasesMap,
      sourcesMap,
      sortBy,
      hideAnomalies
    );
  }, [
    debouncedQuery,
    debouncedMode,
    indexes,
    phrasesMap,
    sourcesMap,
    sortBy,
    hideAnomalies,
  ]);

  const totalMatches = useMemo(
    () => groupedResults.reduce((acc, g) => acc + g.matches.length, 0),
    [groupedResults]
  );

  const handleDgChange = (val: string) => {
    setActiveMode('dg');
    setDgInput(val);
    if (tthInput) setTthInput('');
    if (englishInput) setEnglishInput('');
  };

  const handleTthChange = (val: string) => {
    setActiveMode('tth');
    setTthInput(val);
    if (dgInput) setDgInput('');
    if (englishInput) setEnglishInput('');
  };

  const handleEnglishChange = (val: string) => {
    setActiveMode('english');
    setEnglishInput(val);
    if (dgInput) setDgInput('');
    if (tthInput) setTthInput('');
  };

  const clearAllInputs = () => {
    setDgInput('');
    setTthInput('');
    setEnglishInput('');
    setDebouncedQuery('');
  };

  const applyExample = (ex: (typeof EXAMPLE_QUERIES)[number]) => {
    if (ex.mode === 'dg') handleDgChange(ex.query);
    else if (ex.mode === 'tth') handleTthChange(ex.query);
    else handleEnglishChange(ex.query);
  };

  const toggleGroup = (sourceId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId],
    }));
  };

  const normalizedPreview = useMemo(() => {
    if (!currentRawQuery.trim() || activeMode === 'english') return null;
    const strict =
      activeMode === 'dg'
        ? normalizeDGQueryToTTH(currentRawQuery)
        : normalizeTTHQuery(currentRawQuery);
    const broad = toBroadTTH(strict);
    return { strict, broad };
  }, [currentRawQuery, activeMode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 shadow-xl">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold text-xl">
                Ꭰ
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Digoliyetanidasdi
                  <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                    CTC Phonetic Corpus
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Cherokee Phonetic & Audio Alignment Search • Pre-Bible CTC Forced Alignment
                </p>
              </div>
            </div>

            {!loading && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                  Phrases: <strong className="text-slate-200">{corpusStats.totalPhrases.toLocaleString()}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                  Sources: <strong className="text-slate-200">{corpusStats.totalSources}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                  Mean Conf: <strong className="text-emerald-400">{corpusStats.meanConfidence}%</strong>
                </span>
              </div>
            )}
          </div>

          {/* Three Exclusive Search Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Box 1: D/G Phonetics */}
            <div
              className={`rounded-xl border p-2.5 transition-all ${
                activeMode === 'dg' && dgInput
                  ? 'bg-slate-900 border-sky-500 ring-2 ring-sky-500/20'
                  : 'bg-slate-900/60 border-slate-800 focus-within:border-sky-500/60'
              }`}
            >
              <label
                htmlFor="search-dg"
                className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-sky-400" />
                  1. D/G Phonetics
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  d→t, g→k, ch→tsh
                </span>
              </label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-500 absolute left-2.5 pointer-events-none" />
                <input
                  id="search-dg"
                  type="text"
                  value={dgInput}
                  onFocus={() => setActiveMode('dg')}
                  onChange={e => handleDgChange(e.target.value)}
                  placeholder="e.g. anichuja, adalenisgv..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                {dgInput && (
                  <button
                    type="button"
                    onClick={clearAllInputs}
                    className="absolute right-2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Box 2: T/TH Phonetics */}
            <div
              className={`rounded-xl border p-2.5 transition-all ${
                activeMode === 'tth' && tthInput
                  ? 'bg-slate-900 border-sky-500 ring-2 ring-sky-500/20'
                  : 'bg-slate-900/60 border-slate-800 focus-within:border-sky-500/60'
              }`}
            >
              <label
                htmlFor="search-tth"
                className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-violet-400" />
                  2. T/TH Phonetics
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Direct T/TH + Broad
                </span>
              </label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-500 absolute left-2.5 pointer-events-none" />
                <input
                  id="search-tth"
                  type="text"
                  value={tthInput}
                  onFocus={() => setActiveMode('tth')}
                  onChange={e => handleTthChange(e.target.value)}
                  placeholder="e.g. anitshutsa, atalenihskv..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                {tthInput && (
                  <button
                    type="button"
                    onClick={clearAllInputs}
                    className="absolute right-2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Box 3: English Translation */}
            <div
              className={`rounded-xl border p-2.5 transition-all ${
                activeMode === 'english' && englishInput
                  ? 'bg-slate-900 border-sky-500 ring-2 ring-sky-500/20'
                  : 'bg-slate-900/60 border-slate-800 focus-within:border-sky-500/60'
              }`}
            >
              <label
                htmlFor="search-english"
                className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                  3. English Translation
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Prefix + Fuzzy
                </span>
              </label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-500 absolute left-2.5 pointer-events-none" />
                <input
                  id="search-english"
                  type="text"
                  value={englishInput}
                  onFocus={() => setActiveMode('english')}
                  onChange={e => handleEnglishChange(e.target.value)}
                  placeholder="e.g. playing ball, roosters..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                {englishInput && (
                  <button
                    type="button"
                    onClick={clearAllInputs}
                    className="absolute right-2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Normalization Preview & Controls Bar */}
          {currentRawQuery.trim() && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400">
                  Found <strong className="text-white">{totalMatches}</strong>{' '}
                  {totalMatches === 1 ? 'phrase' : 'phrases'} across{' '}
                  <strong className="text-white">{groupedResults.length}</strong>{' '}
                  {groupedResults.length === 1 ? 'source' : 'sources'}
                </span>

                {normalizedPreview && (
                  <div className="flex items-center gap-2 font-mono">
                    <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
                      Strict T/TH: <strong>{normalizedPreview.strict}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/30">
                      Broad: <strong>{normalizedPreview.broad}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Sort & Confidence Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortOption)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
                  >
                    <option value="matched_confidence">
                      Matched Word Confidence (High → Low)
                    </option>
                    <option value="phrase_confidence">
                      Phrase Mean Confidence (High → Low)
                    </option>
                    <option value="canonical">
                      Canonical Source & Verse Order
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setHideAnomalies(prev => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition ${
                    hideAnomalies
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  {hideAnomalies ? 'Hiding Flagged Anomalies' : 'Hide Flagged'}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {loading && (
          <div className="text-center py-20 text-slate-400">
            <div className="inline-block w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-mono">
              Loading 3,606 aligned Cherokee phrases & building 3-gram indexes...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/50 border border-rose-500/40 rounded-xl p-6 text-rose-200 text-center">
            <p className="font-semibold mb-1">Failed to load corpus</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        )}

        {/* Empty State Dashboard */}
        {!loading && !error && !debouncedQuery.trim() && (
          <div className="max-w-3xl mx-auto my-8 bg-slate-900/50 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-mono uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4" />
              Ready to Search
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Explore Spoken Cherokee Phonetics & Forced Audio Alignments
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Type in any of the three boxes above to search across{' '}
              <strong className="text-slate-200">
                {corpusStats.totalPhrases.toLocaleString()}
              </strong>{' '}
              aligned utterances ({corpusStats.totalHours} hours of audio) from the{' '}
              <strong className="text-slate-200">
                1975 Durbin Feeling Cherokee Dictionary
              </strong>{' '}
              and the{' '}
              <strong className="text-slate-200">Cherokee New Testament</strong>.
              Matches are ranked and color-coded by CTC acoustic alignment confidence.
            </p>

            {/* Confidence Color Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6 text-xs">
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold">High Confidence (≥ 80%)</div>
                  <div className="text-[11px] opacity-80">Clean acoustic alignment</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold">Medium Confidence (10–79%)</div>
                  <div className="text-[11px] opacity-80">Rapid speech / vowel drop</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
                <div>
                  <div className="font-semibold">Low / Flagged (&lt; 10%)</div>
                  <div className="text-[11px] opacity-80">Divergent audio/text</div>
                </div>
              </div>
            </div>

            {/* Clickable Example Chips */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Try an Example Query:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {EXAMPLE_QUERIES.map(ex => (
                  <button
                    key={`${ex.mode}-${ex.label}`}
                    type="button"
                    onClick={() => applyExample(ex)}
                    className="flex items-center justify-between text-left p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/40 transition cursor-pointer group"
                  >
                    <div>
                      <div className="font-mono text-sm font-semibold text-sky-300 group-hover:text-sky-200">
                        "{ex.label}"
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {ex.description}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
                      {ex.mode === 'dg'
                        ? 'D/G'
                        : ex.mode === 'tth'
                          ? 'T/TH'
                          : 'ENG'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No Matches Found */}
        {!loading &&
          !error &&
          debouncedQuery.trim() &&
          groupedResults.length === 0 && (
            <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl">
              <p className="text-base text-slate-300 font-medium mb-1">
                No matching phrases found for "{debouncedQuery}"
              </p>
              <p className="text-xs text-slate-500">
                Try a shorter phonetic root, switch between D/G and T/TH boxes, or
                uncheck "Hide Flagged".
              </p>
            </div>
          )}

        {/* Grouped Search Results */}
        {!loading && !error && groupedResults.length > 0 && (
          <div className="space-y-6">
            {groupedResults.map(group => {
              const isCollapsed = Boolean(collapsedGroups[group.source.source_id]);
              return (
                <section
                  key={group.source.source_id}
                  className="bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.source.source_id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/80 hover:bg-slate-900 border-b border-slate-800/60 text-left cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2.5">
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                      <h2 className="font-bold text-sm sm:text-base text-white">
                        {group.source.title}
                      </h2>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                        {group.matches.length}{' '}
                        {group.matches.length === 1 ? 'match' : 'matches'}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-400">
                      Top Conf:{' '}
                      <strong className="text-slate-200">
                        {(group.topConfidence * 100).toFixed(1)}%
                      </strong>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="p-4 space-y-3">
                      {group.matches.map(match => (
                        <PhraseCard
                          key={match.id}
                          phrase={match}
                          query={debouncedQuery}
                          mode={debouncedMode}
                          isActiveAudio={activeAudioPhraseId === match.id}
                          onActivateAudio={setActiveAudioPhraseId}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
export default App;
