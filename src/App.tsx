import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Eye,
  EyeOff,
  Gauge,
  HelpCircle,
  Info,
  Languages,
  Layers,
  Search,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import type {
  DocumentMeta,
  PhraseRecord,
  ScoredPhraseMatch,
  SearchMode,
  SortOption,
  SourceType,
} from './types/corpus';
import {
  buildTurnPartCountsMap,
  createCorpusIndexes,
  flattenAndSortMatches,
  searchCorpus,
} from './lib/search';
import { PhraseCard } from './components/PhraseCard';
import { ContextDetailPane } from './components/ContextDetailPane';

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
    description: '"boys" — Standard (d/t) spelling',
  },
  {
    label: 'adalenisgv',
    query: 'adalenisgv',
    mode: 'dg',
    description: '"in the beginning" — Standard (d/t) spelling',
  },
  {
    label: 'sgwà:hle̋:sdi',
    query: 'sgwà:hle̋:sdi',
    mode: 'dg',
    description: '"ball" — Dictionary spelling with tone marks',
  },
  {
    label: 'anitshutsa',
    query: 'anitshutsa',
    mode: 'tth',
    description: '"boys" — Linguistic (t/th) spelling',
  },
  {
    label: 'anitsutsa',
    query: 'anitsutsa',
    mode: 'tth',
    description: '"boys" — Relaxed spelling (without h)',
  },
  {
    label: 'tshutsa tananelo',
    query: 'tshutsa tananelo',
    mode: 'tth',
    description: '"boys playing" — Multi-word search',
  },
  {
    label: 'playing ball',
    query: 'playing ball',
    mode: 'english',
    description: 'Search by English meaning',
  },
  {
    label: 'roosters',
    query: 'roosters',
    mode: 'english',
    description: 'Search by English word',
  },
];

const SOURCE_TYPE_OPTIONS: Array<{
  value: 'all' | SourceType;
  label: string;
}> = [
  { value: 'all', label: 'All Collections' },
  { value: 'dictionary_collection', label: '1975 Dictionary' },
  { value: 'biblical_chapter', label: 'New Testament' },
  { value: 'marked_syllabary_corpus', label: 'Saving the Voices' },
];

export const App: React.FC = () => {
  const [sources, setSources] = useState<DocumentMeta[]>([]);
  const [phrases, setPhrases] = useState<PhraseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Three exclusive search box states (draft inputs)
  const [dgInput, setDgInput] = useState('');
  const [tthInput, setTthInput] = useState('');
  const [englishInput, setEnglishInput] = useState('');
  const [activeMode, setActiveMode] = useState<SearchMode>('dg');

  // Committed query & mode (updated on Enter / Search button / Example click)
  const [committedQuery, setCommittedQuery] = useState('');
  const [committedMode, setCommittedMode] = useState<SearchMode>('dg');

  // Sorting, Grouping & Filtering
  const [sortBy, setSortBy] = useState<SortOption>('matched_confidence');
  const [groupBySource, setGroupBySource] = useState(true);
  const [userDisabledGroupingInNormalSort, setUserDisabledGroupingInNormalSort] =
    useState(false);
  const [showLowConfidence, setShowLowConfidence] = useState(false);
  const [hideAnomalies, setHideAnomalies] = useState(false);
  const [selectedSourceType, setSelectedSourceType] = useState<'all' | SourceType>('all');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [activeAudioPhraseId, setActiveAudioPhraseId] = useState<string | null>(null);
  const [contextPhrase, setContextPhrase] = useState<PhraseRecord | null>(null);
  const [showTerminology, setShowTerminology] = useState(false);
  const [showUnderTheHood, setShowUnderTheHood] = useState(false);

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

  const isDirty =
    currentRawQuery.trim() !== committedQuery.trim() ||
    (currentRawQuery.trim().length > 0 && activeMode !== committedMode);

  const executeSearch = () => {
    setCommittedQuery(currentRawQuery.trim());
    setCommittedMode(activeMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch();
    }
  };

  const { indexes, phrasesMap, sourcesMap, turnPartCountsMap, corpusStats } = useMemo(() => {
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

    const idxs = createCorpusIndexes(phrases);
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

  const availableSources = useMemo(() => {
    if (selectedSourceType === 'all') return sources;
    return sources.filter(s => s.source_type === selectedSourceType);
  }, [sources, selectedSourceType]);

  const handleSourceTypeChange = (type: 'all' | SourceType) => {
    setSelectedSourceType(type);
    if (type !== 'all' && selectedSourceId !== 'all') {
      const currentSrc = sourcesMap.get(selectedSourceId);
      if (!currentSrc || currentSrc.source_type !== type) {
        setSelectedSourceId('all');
      }
    }
  };

  const groupedResults = useMemo(() => {
    if (!committedQuery.trim()) return [];
    return searchCorpus(
      committedQuery,
      committedMode,
      indexes,
      phrasesMap,
      sourcesMap,
      sortBy,
      {
        minConfidence: showLowConfidence ? 0 : 0.05,
        hideAnomalies,
        sourceType: selectedSourceType,
        sourceId: selectedSourceId,
      }
    );
  }, [
    committedQuery,
    committedMode,
    indexes,
    phrasesMap,
    sourcesMap,
    sortBy,
    showLowConfidence,
    hideAnomalies,
    selectedSourceType,
    selectedSourceId,
  ]);

  const totalMatches = useMemo(
    () => groupedResults.reduce((acc, g) => acc + g.matches.length, 0),
    [groupedResults]
  );

  const flatResults = useMemo(
    () => flattenAndSortMatches(groupedResults, sortBy, sourcesMap),
    [groupedResults, sortBy, sourcesMap]
  );

  const scoredMatchesMap = useMemo(() => {
    const m = new Map<string, ScoredPhraseMatch>();
    for (const g of groupedResults) {
      for (const match of g.matches) {
        m.set(match.id, match);
      }
    }
    return m;
  }, [groupedResults]);

  const handleSortChange = (nextSort: SortOption) => {
    const prevSort = sortBy;
    setSortBy(nextSort);
    if (nextSort === 'shortest_sentence') {
      setGroupBySource(false);
    } else if (prevSort === 'shortest_sentence') {
      if (!userDisabledGroupingInNormalSort) {
        setGroupBySource(true);
      }
    }
  };

  const handleGroupBySourceChange = (checked: boolean) => {
    setGroupBySource(checked);
    if (sortBy !== 'shortest_sentence') {
      setUserDisabledGroupingInNormalSort(!checked);
    }
  };

  const contextSource = contextPhrase
    ? sourcesMap.get(contextPhrase.source_id)
    : undefined;

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
    setCommittedQuery('');
  };

  const applyExample = (ex: (typeof EXAMPLE_QUERIES)[number]) => {
    if (ex.mode === 'dg') handleDgChange(ex.query);
    else if (ex.mode === 'tth') handleTthChange(ex.query);
    else handleEnglishChange(ex.query);
    setCommittedQuery(ex.query.trim());
    setCommittedMode(ex.mode);
  };

  const toggleGroup = (sourceId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId],
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-bold text-xl shadow-2xs">
                Ꭰ
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  Digoliyetanidasdi
                </h1>
                <p className="text-xs text-slate-500">
                  Search Spoken Cherokee Recordings & Translations
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowTerminology(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition cursor-pointer"
                title="Learn how Cherokee spelling search and audio word highlighting work"
              >
                <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                <span>How It Works</span>
              </button>

              {!loading && (
                <>
                  <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 shadow-2xs">
                    Recordings: <strong className="text-slate-900">{corpusStats.totalPhrases.toLocaleString()}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 shadow-2xs">
                    Sources: <strong className="text-slate-900">{corpusStats.totalSources}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Three Exclusive Search Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Box 1: Standard (d/t) */}
            <div
              className={`rounded-xl border p-2.5 transition-all ${
                activeMode === 'dg' && dgInput
                  ? 'bg-white border-sky-500 ring-2 ring-sky-500/15 shadow-sm'
                  : 'bg-slate-100/70 border-slate-200 focus-within:bg-white focus-within:border-sky-500/60 shadow-2xs'
              }`}
            >
              <label
                htmlFor="search-dg"
                className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-sky-600" />
                  1. Standard Spelling (d/t)
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Community & Dictionary
                </span>
              </label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  id="search-dg"
                  type="text"
                  value={dgInput}
                  onFocus={() => setActiveMode('dg')}
                  onChange={e => handleDgChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. anichuja, adalenisgv..."
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                />
                {dgInput && (
                  <button
                    type="button"
                    onClick={clearAllInputs}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Box 2: Linguistic (t/th) */}
            <div
              className={`rounded-xl border p-2.5 transition-all ${
                activeMode === 'tth' && tthInput
                  ? 'bg-white border-sky-500 ring-2 ring-sky-500/15 shadow-sm'
                  : 'bg-slate-100/70 border-slate-200 focus-within:bg-white focus-within:border-sky-500/60 shadow-2xs'
              }`}
            >
              <label
                htmlFor="search-tth"
                className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-violet-600" />
                  2. Linguistic Spelling (t/th)
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Aspirated Sounds
                </span>
              </label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  id="search-tth"
                  type="text"
                  value={tthInput}
                  onFocus={() => setActiveMode('tth')}
                  onChange={e => handleTthChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. anitshutsa, atalenihskv..."
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                />
                {tthInput && (
                  <button
                    type="button"
                    onClick={clearAllInputs}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Box 3: English Meaning */}
            <div
              className={`rounded-xl border p-2.5 transition-all ${
                activeMode === 'english' && englishInput
                  ? 'bg-white border-sky-500 ring-2 ring-sky-500/15 shadow-sm'
                  : 'bg-slate-100/70 border-slate-200 focus-within:bg-white focus-within:border-sky-500/60 shadow-2xs'
              }`}
            >
              <label
                htmlFor="search-english"
                className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                  3. English Meaning
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Word or Phrase
                </span>
              </label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  id="search-english"
                  type="text"
                  value={englishInput}
                  onFocus={() => setActiveMode('english')}
                  onChange={e => handleEnglishChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. playing ball, roosters..."
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                />
                {englishInput && (
                  <button
                    type="button"
                    onClick={clearAllInputs}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Search Action + Source & Quality Filter Bar */}
          <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col gap-2.5 text-xs">
            {/* Row 1: Search Trigger, Source Collection Pills & Specific Source Dropdown */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Left: Search / Update Search Button */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={executeSearch}
                  disabled={!currentRawQuery.trim() && !committedQuery.trim()}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer shadow-xs ${
                    isDirty && currentRawQuery.trim()
                      ? 'bg-sky-600 hover:bg-sky-500 text-white ring-2 ring-sky-400/40 animate-pulse'
                      : currentRawQuery.trim()
                        ? 'bg-sky-600 hover:bg-sky-700 text-white'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  {isDirty && committedQuery
                    ? 'Update Search'
                    : 'Search'}
                  <span className="inline-flex items-center gap-0.5 text-[10px] opacity-90 font-mono ml-0.5 px-1 py-0.2 rounded bg-black/15">
                    <CornerDownLeft className="w-2.5 h-2.5" />
                    Enter
                  </span>
                </button>
              </div>

              {/* Right: Source Collection Pills & Specific Source Dropdown */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <Layers className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5 hidden sm:inline" />
                  {SOURCE_TYPE_OPTIONS.map(opt => {
                    const active = selectedSourceType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSourceTypeChange(opt.value)}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                          active
                            ? 'bg-white text-sky-700 shadow-2xs border border-slate-200 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 border border-transparent'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <select
                  aria-label="Filter by specific source"
                  value={selectedSourceId}
                  onChange={e => setSelectedSourceId(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500 max-w-[230px] truncate shadow-2xs"
                >
                  <option value="all">
                    All Sources ({availableSources.length})
                  </option>
                  {availableSources.map(s => (
                    <option key={s.source_id} value={s.source_id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Match Status, Include Uncertain Matches Toggle & Sort */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {committedQuery.trim() ? (
                  <span className="text-slate-600">
                    Showing <strong className="text-slate-900">{totalMatches}</strong>{' '}
                    {totalMatches === 1 ? 'recording' : 'recordings'} across{' '}
                    <strong className="text-slate-900">{groupedResults.length}</strong>{' '}
                    {groupedResults.length === 1 ? 'source' : 'sources'} for{' '}
                    <span className="font-mono text-sky-700 font-semibold">"{committedQuery}"</span>
                    {isDirty && currentRawQuery.trim() && (
                      <span className="ml-2 text-amber-700 font-medium">
                        • Press Enter or click "Update Search" for "{currentRawQuery.trim()}"
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-500">
                    {currentRawQuery.trim()
                      ? 'Press Enter or click Search to run query.'
                      : 'Word timings are computer-generated and may occasionally be off.'}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Single toggle for uncertain / noisy matches */}
                <button
                  type="button"
                  onClick={() => {
                    setShowLowConfidence(prev => !prev);
                    setHideAnomalies(false);
                  }}
                  title={
                    showLowConfidence
                      ? 'Currently including recordings where computer word-timing is very uncertain (<5% confidence). Click to hide them.'
                      : 'Recordings where computer word-timing is very uncertain (<5% confidence) are hidden by default. Click to include them.'
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition ${
                    showLowConfidence
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {showLowConfidence ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-amber-600" />
                      Including uncertain matches
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      Include uncertain matches
                    </>
                  )}
                </button>

                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500">Sort:</span>
                    <select
                      aria-label="Sort results"
                      value={sortBy}
                      onChange={e => handleSortChange(e.target.value as SortOption)}
                      className="bg-white border border-slate-300 text-slate-800 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-sky-500 shadow-2xs"
                    >
                      <option value="matched_confidence">
                        Best Audio Match
                      </option>
                      <option value="phrase_confidence">
                        Clearest Recording
                      </option>
                      <option value="shortest_sentence">
                        Shortest Phrase
                      </option>
                      <option value="canonical">
                        Book / Interview Order
                      </option>
                    </select>
                  </div>

                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer select-none shadow-2xs transition">
                    <input
                      type="checkbox"
                      checked={groupBySource}
                      onChange={e => handleGroupBySourceChange(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <span>Group by source</span>
                  </label>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {loading && (
          <div className="text-center py-20 text-slate-500">
            <div className="inline-block w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">
              Loading Cherokee audio recordings and search index...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800 text-center">
            <p className="font-semibold mb-1">Failed to load recordings</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        )}

        {/* Empty State Dashboard */}
        {!loading && !error && !committedQuery.trim() && (
          <div className="max-w-3xl mx-auto my-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2 text-sky-700 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4" />
              Ready to Search
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              Listen to Spoken Cherokee Words & Sentences
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Type a word or phrase in any of the three boxes above and press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs border border-slate-200">Enter</kbd> (or click <strong>Search</strong>) to hear{' '}
              <strong className="text-slate-900">
                {corpusStats.totalPhrases.toLocaleString()}
              </strong>{' '}
              spoken recordings ({corpusStats.totalHours} hours of audio) from the{' '}
              <strong className="text-slate-900">
                1975 Durbin Feeling Cherokee Dictionary
              </strong>
              , the{' '}
              <strong className="text-slate-900">Cherokee New Testament</strong>, and{' '}
              <strong className="text-slate-900">Saving the Voices</strong> elder interviews.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mb-6 flex items-start gap-2 bg-slate-50 border border-slate-200/80 rounded-lg p-3">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>
                <strong>Note on word timing:</strong> Word-by-word audio timestamps are computer-generated so you can click any word to hear it spoken. Because natural conversation is fast and expressive, the computer alignment can occasionally be slightly off. Hover over any word or badge to view its exact confidence score.
              </span>
            </p>

            {/* Match Quality Color Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6 text-xs">
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <div className="font-semibold">Clear Match</div>
                  <div className="text-[11px] text-emerald-700">Crisp audio & word timing</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <div>
                  <div className="font-semibold">Approximate Match</div>
                  <div className="text-[11px] text-amber-700">Fast conversational speech</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <div>
                  <div className="font-semibold">Uncertain Timing</div>
                  <div className="text-[11px] text-rose-700">Timing may be slightly off</div>
                </div>
              </div>
            </div>

            {/* Clickable Example Chips */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Try an Example Search:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {EXAMPLE_QUERIES.map(ex => (
                  <button
                    key={`${ex.mode}-${ex.label}`}
                    type="button"
                    onClick={() => applyExample(ex)}
                    className="flex items-center justify-between text-left p-3 rounded-xl bg-slate-50 hover:bg-sky-50/70 border border-slate-200 hover:border-sky-300 transition cursor-pointer group shadow-2xs"
                  >
                    <div>
                      <div className="font-mono text-sm font-semibold text-sky-800 group-hover:text-sky-950">
                        "{ex.label}"
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {ex.description}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shadow-2xs">
                      {ex.mode === 'dg'
                        ? 'Standard'
                        : ex.mode === 'tth'
                          ? 'Linguistic'
                          : 'English'}
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
          committedQuery.trim() &&
          groupedResults.length === 0 && (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <p className="text-base text-slate-800 font-medium mb-1">
                No matching recordings found for "{committedQuery}"
              </p>
              <p className="text-xs text-slate-500">
                Try a shorter part of the word, switch collection filters, or click
                "Include uncertain matches" at the top.
              </p>
            </div>
          )}

        {/* Search Results */}
        {!loading && !error && groupedResults.length > 0 && (
          <div className="space-y-6">
            {groupBySource ? (
              groupedResults.map(group => {
                const isCollapsed = Boolean(collapsedGroups[group.source.source_id]);
                return (
                  <section
                    key={group.source.source_id}
                    className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.source.source_id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/90 hover:bg-slate-100/90 border-b border-slate-200 text-left cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                        <h2 className="font-bold text-sm sm:text-base text-slate-900">
                          {group.source.title}
                        </h2>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                          {group.matches.length}{' '}
                          {group.matches.length === 1 ? 'recording' : 'recordings'}
                        </span>
                      </div>

                      <div
                        className="text-xs text-slate-500 flex items-center gap-1"
                        title={`Highest alignment confidence in this source: ${(group.topConfidence * 100).toFixed(1)}%`}
                      >
                        <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Click any word to listen</span>
                      </div>
                    </button>

                    {!isCollapsed && (
                      <div className="p-4 space-y-3">
                        {group.matches.map(match => (
                          <PhraseCard
                            key={match.id}
                            phrase={match}
                            source={group.source}
                            showSourceBadge={false}
                            turnPartInfo={turnPartCountsMap.get(match.id)}
                            isContextTarget={contextPhrase?.id === match.id}
                            onViewInContext={setContextPhrase}
                            query={committedQuery}
                            mode={committedMode}
                            isActiveAudio={activeAudioPhraseId === match.id}
                            onActivateAudio={setActiveAudioPhraseId}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })
            ) : (
              <div className="space-y-3">
                {flatResults.map(match => {
                  const src = sourcesMap.get(match.source_id);
                  return (
                    <PhraseCard
                      key={match.id}
                      phrase={match}
                      source={src}
                      showSourceBadge={true}
                      turnPartInfo={turnPartCountsMap.get(match.id)}
                      isContextTarget={contextPhrase?.id === match.id}
                      onViewInContext={setContextPhrase}
                      query={committedQuery}
                      mode={committedMode}
                      isActiveAudio={activeAudioPhraseId === match.id}
                      onActivateAudio={setActiveAudioPhraseId}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Fixed Slide-Out Context Detail Panel (Right Drawer on Desktop, Full Screen on <lg) */}
      {contextPhrase && contextSource && (
        <ContextDetailPane
          targetPhrase={contextPhrase}
          source={contextSource}
          allPhrases={phrases}
          scoredMatchesMap={scoredMatchesMap}
          turnPartCountsMap={turnPartCountsMap}
          query={committedQuery}
          mode={committedMode}
          activeAudioPhraseId={activeAudioPhraseId}
          onActivateAudio={setActiveAudioPhraseId}
          onSelectContextPhrase={setContextPhrase}
          onClose={() => setContextPhrase(null)}
        />
      )}

      {/* How It Works Modal */}
      {showTerminology && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-base text-slate-900">
                  How Digoliyetanidasdi Works
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTerminology(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 leading-relaxed">
              <section>
                <h4 className="font-semibold text-slate-900 text-sm mb-1.5 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-sky-600" />
                  Listening Word-by-Word
                </h4>
                <p className="text-xs leading-relaxed">
                  <strong>Digoliyetanidasdi</strong> (ᏗᎪᎵᏰᏔᏂᏓᏍᏗ) connects written Cherokee and English translations directly to spoken audio recordings. Click the <strong>Play</strong> button to hear the whole phrase, or <strong>click directly on any Cherokee word</strong> to jump right to that moment in the recording. You can also slow down playback to <code>0.75x</code> or <code>0.5x</code> to hear pronunciation details clearly.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-sky-600" />
                  Two Ways to Spell Cherokee in English Letters
                </h4>
                <p className="text-xs mb-2.5">
                  Different Cherokee dictionaries and learning programs write Cherokee sounds in English letters differently. You can search using whichever style you know best:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-semibold text-slate-900 mb-1">
                      1. Standard Spelling (d/t)
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Used in the 1975 Durbin Feeling Dictionary and most community classes. Uses <strong>d</strong>, <strong>g</strong>, <strong>j</strong>, and <strong>ch</strong> (for example: <code>gadu</code> for bread, <code>anichuja</code> for boys, <code>adalenisgv</code> for beginning).
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-semibold text-slate-900 mb-1">
                      2. Linguistic Spelling (t/th)
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Highlights the difference between soft sounds (<strong>t</strong>, <strong>k</strong>, <strong>ts</strong>) and sounds spoken with a puff of air (<strong>th</strong>, <strong>kh</strong>, <strong>tsh</strong>) — for example: <code>katu</code>, <code>anitshutsa</code>, <code>atalenihskv</code>.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-emerald-600" />
                  Computer-Generated Word Timing & Quality Colors
                </h4>
                <p className="text-xs mb-2.5">
                  A computer model listened to every recording and matched the spoken audio to the written transcript. Because fluent elders speak naturally — sometimes blending words, speaking quickly, or dropping quiet vowels — the computer's timing is sometimes approximate. Hover your mouse over any word or badge to inspect its exact confidence percentage:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <strong>Clear match (≥ 80%)</strong>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Crisp audio alignment. Great for studying word pronunciation.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                    <strong>Approximate (10–79%)</strong>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Fast conversational speech or natural vowel dropping.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                    <strong>Uncertain (&lt; 10%)</strong>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      Background noise or overlap. Very uncertain matches (&lt;5%) are hidden unless you click "Include uncertain matches".
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="font-semibold text-slate-900 text-sm mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-teal-600" />
                  About the Recording Collections
                </h4>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>
                    <strong>1975 Dictionary</strong>: Clear studio recordings of headwords and example sentences from the Durbin Feeling <em>Cherokee-English Dictionary</em>.
                  </li>
                  <li>
                    <strong>New Testament</strong>: Continuous chapter readings of the Cherokee New Testament.
                  </li>
                  <li>
                    <strong>Saving the Voices (ᎠᏂᏬᏂᏍᎩ ᎤᏂᏍᏆᏂᎪᏛᎢ)</strong>: Unscripted interviews with fluent Cherokee elders sharing stories, history, and everyday conversation.
                  </li>
                </ul>
              </section>

              {/* Expandable Under the Hood Section for Curious Readers / Linguists */}
              <section className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUnderTheHood(prev => !prev)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-sky-700 cursor-pointer"
                >
                  {showUnderTheHood ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                  <span>Under the Hood (For Linguists & Technical Readers)</span>
                </button>

                {showUnderTheHood && (
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-600">
                    <p>
                      <strong>Acoustic Forced Alignment:</strong> Recordings are aligned using a Wav2Vec2-CTC acoustic model trained on historical Cherokee speech, paired with Silero Voice Activity Detection (VAD) soft-masking.
                    </p>
                    <p>
                      <strong>Vowel Dropping (Syncope) & Intrusions:</strong> Conversational Cherokee frequently drops unstressed short vowels and inserts unwritten phonetic aspiration (<em>h</em>) or glottal stops (<code>'</code>). Our alignment pipeline uses a syncope- and intrusion-aware dynamic programming trellis so conversational elisions align cleanly without derailing word boundaries.
                    </p>
                    <p>
                      <strong>Orthographic Transduction:</strong> Standard (d/t) queries are normalized to unaspirated/aspirated (t/th) representations at search time, with an automatic broad fallback (stripping <em>h</em> and glottal stops) so learners can find words even if aspiration is omitted.
                    </p>
                  </div>
                )}
              </section>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTerminology(false)}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg text-xs cursor-pointer shadow-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
