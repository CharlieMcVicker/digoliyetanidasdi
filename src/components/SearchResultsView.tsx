import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Volume2 } from 'lucide-react';
import type {
  DocumentMeta,
  GroupedSearchResult,
  PhraseRecord,
  ScoredPhraseMatch,
  SearchMode,
} from '../types/corpus';
import { PhraseCard } from './PhraseCard';

export interface SearchResultsViewProps {
  committedQuery: string;
  committedMode: SearchMode;
  groupBySource: boolean;
  groupedResults: GroupedSearchResult[];
  flatResults: ScoredPhraseMatch[];
  sourcesMap: Map<string, DocumentMeta>;
  turnPartCountsMap: Map<string, { turnId: string; phraseIndex: number; turnPhraseCount: number }>;
  activeAudioPhraseId: string | null;
  onActivateAudio: (phraseId: string) => void;
  contextPhrase: PhraseRecord | null;
  onViewInContext: (phrase: PhraseRecord) => void;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  committedQuery,
  committedMode,
  groupBySource,
  groupedResults,
  flatResults,
  sourcesMap,
  turnPartCountsMap,
  activeAudioPhraseId,
  onActivateAudio,
  contextPhrase,
  onViewInContext,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (sourceId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId],
    }));
  };

  if (committedQuery.trim() && groupedResults.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <p className="text-base text-slate-800 font-medium mb-1">
          No matching recordings found for "{committedQuery}"
        </p>
        <p className="text-xs text-slate-500">
          Try a shorter part of the word, switch collection filters, or click
          "Include uncertain matches" at the top.
        </p>
      </div>
    );
  }

  return (
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
                      onViewInContext={onViewInContext}
                      query={committedQuery}
                      mode={committedMode}
                      isActiveAudio={activeAudioPhraseId === match.id}
                      onActivateAudio={onActivateAudio}
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
                onViewInContext={onViewInContext}
                query={committedQuery}
                mode={committedMode}
                isActiveAudio={activeAudioPhraseId === match.id}
                onActivateAudio={onActivateAudio}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
