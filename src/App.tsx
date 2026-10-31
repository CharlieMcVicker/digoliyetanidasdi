import React, { useState } from 'react';
import type { PhraseRecord } from './types/corpus';
import { useCorpusData } from './hooks/useCorpusData';
import { useCorpusSearch } from './hooks/useCorpusSearch';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { FilterBar } from './components/FilterBar';
import { EmptyDashboard } from './components/EmptyDashboard';
import { SearchResultsView } from './components/SearchResultsView';
import { TerminologyModal } from './components/TerminologyModal';
import { ContextDetailPane } from './components/ContextDetailPane';

export const App: React.FC = () => {
  const {
    sources,
    phrases,
    loading,
    error,
    indexes,
    phrasesMap,
    sourcesMap,
    turnPartCountsMap,
    corpusStats,
  } = useCorpusData();

  const {
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
  } = useCorpusSearch({
    sources,
    indexes,
    phrasesMap,
    sourcesMap,
  });

  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [activeAudioPhraseId, setActiveAudioPhraseId] = useState<string | null>(null);
  const [contextPhrase, setContextPhrase] = useState<PhraseRecord | null>(null);
  const [showTerminology, setShowTerminology] = useState(false);

  const contextSource = contextPhrase
    ? sourcesMap.get(contextPhrase.source_id)
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5">
          <Header
            loading={loading}
            corpusStats={corpusStats}
            onOpenTerminology={() => setShowTerminology(true)}
          />

          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchMode={searchMode}
            setSearchMode={setSearchMode}
            committedQuery={committedQuery}
            isDirty={isDirty}
            onExecuteSearch={executeSearch}
            onClearInput={clearInput}
            totalMatches={totalMatches}
            groupedResultsCount={groupedResults.length}
            showMobileFilters={showMobileFilters}
            setShowMobileFilters={setShowMobileFilters}
            activeFilterCount={activeFilterCount}
          />

          <FilterBar
            showMobileFilters={showMobileFilters}
            selectedSourceType={selectedSourceType}
            onSourceTypeChange={handleSourceTypeChange}
            selectedSourceId={selectedSourceId}
            onSourceIdChange={setSelectedSourceId}
            availableSources={availableSources}
            showLowConfidence={showLowConfidence}
            onToggleLowConfidence={() => setShowLowConfidence(prev => !prev)}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            groupBySource={groupBySource}
            onGroupBySourceChange={handleGroupBySourceChange}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
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
          <EmptyDashboard
            corpusStats={corpusStats}
            onApplyExample={applyExample}
          />
        )}

        {/* Search Results */}
        {!loading && !error && (
          <SearchResultsView
            committedQuery={committedQuery}
            committedMode={committedMode}
            groupBySource={groupBySource}
            groupedResults={groupedResults}
            flatResults={flatResults}
            sourcesMap={sourcesMap}
            turnPartCountsMap={turnPartCountsMap}
            activeAudioPhraseId={activeAudioPhraseId}
            onActivateAudio={setActiveAudioPhraseId}
            contextPhrase={contextPhrase}
            onViewInContext={setContextPhrase}
          />
        )}
      </main>

      {/* Fixed Slide-Out Context Detail Panel */}
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
      <TerminologyModal
        isOpen={showTerminology}
        onClose={() => setShowTerminology(false)}
      />
    </div>
  );
};

export default App;
