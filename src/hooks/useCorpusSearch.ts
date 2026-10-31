import { useMemo, useState } from 'react';
import type {
  DocumentMeta,
  PhraseRecord,
  ScoredPhraseMatch,
  SearchMode,
  SortOption,
  SourceType,
} from '../types/corpus';
import {
  flattenAndSortMatches,
  searchCorpus,
  type CorpusIndexes,
} from '../lib/search';

export interface UseCorpusSearchParams {
  sources: DocumentMeta[];
  indexes: CorpusIndexes | null;
  phrasesMap: Map<string, PhraseRecord>;
  sourcesMap: Map<string, DocumentMeta>;
}

export function useCorpusSearch({
  sources,
  indexes,
  phrasesMap,
  sourcesMap,
}: UseCorpusSearchParams) {
  // Unified search input & mode dropdown
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('dg');

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

  const isDirty =
    searchQuery.trim() !== committedQuery.trim() ||
    (searchQuery.trim().length > 0 && searchMode !== committedMode);

  const executeSearch = () => {
    setCommittedQuery(searchQuery.trim());
    setCommittedMode(searchMode);
  };

  const clearInput = () => {
    setSearchQuery('');
    setCommittedQuery('');
  };

  const applyExample = (ex: { query: string; mode: SearchMode }) => {
    setSearchQuery(ex.query);
    setSearchMode(ex.mode);
    setCommittedQuery(ex.query.trim());
    setCommittedMode(ex.mode);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSourceType !== 'all') count++;
    if (selectedSourceId !== 'all') count++;
    if (showLowConfidence) count++;
    if (sortBy !== 'matched_confidence') count++;
    if (!groupBySource) count++;
    return count;
  }, [selectedSourceType, selectedSourceId, showLowConfidence, sortBy, groupBySource]);

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

  const groupedResults = useMemo(() => {
    if (!committedQuery.trim() || !indexes) return [];
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

  return {
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    committedQuery,
    committedMode,
    isDirty,
    executeSearch,
    clearInput,
    applyExample,
    sortBy,
    handleSortChange,
    groupBySource,
    handleGroupBySourceChange,
    showLowConfidence,
    setShowLowConfidence,
    hideAnomalies,
    setHideAnomalies,
    selectedSourceType,
    handleSourceTypeChange,
    selectedSourceId,
    setSelectedSourceId,
    availableSources,
    activeFilterCount,
    groupedResults,
    flatResults,
    totalMatches,
    scoredMatchesMap,
  };
}
