/**
 * src/lib/search.ts
 *
 * In-memory multi-index search engine, candidate post-filtering,
 * and confidence-weighted ranking over the Cherokee corpus.
 */

import MiniSearch from 'minisearch';
import type {
  DocumentMeta,
  GroupedSearchResult,
  PhraseRecord,
  ScoredPhraseMatch,
  SearchFilterOptions,
  SearchMode,
  SortOption,
} from '../types/corpus';
import {
  normalizeDGQueryToTTH,
  normalizeTTHQuery,
  phoneticNgramTokenizer,
  toBroadTTH,
} from './phonetics';

// Re-export pure domain modules for full backwards compatibility
export * from './phonetics';
export * from './context';
export * from './highlight';

export interface CorpusIndexes {
  strictPhoneticIndex: MiniSearch<PhraseRecord>;
  broadPhoneticIndex: MiniSearch<PhraseRecord>;
  englishIndex: MiniSearch<PhraseRecord>;
}

/**
 * Initializes the three MiniSearch indexes (Strict Phonetic, Broad Phonetic, English).
 */
export function createCorpusIndexes(phrases: PhraseRecord[]): CorpusIndexes {
  const strictPhoneticIndex = new MiniSearch<PhraseRecord>({
    fields: ['phonetic_text'],
    storeFields: ['id'],
    tokenize: phoneticNgramTokenizer,
    searchOptions: { combineWith: 'AND', prefix: false },
  });

  const broadPhoneticIndex = new MiniSearch<PhraseRecord>({
    fields: ['phonetic_broad'],
    storeFields: ['id'],
    tokenize: phoneticNgramTokenizer,
    searchOptions: { combineWith: 'AND', prefix: false },
  });

  const englishIndex = new MiniSearch<PhraseRecord>({
    fields: ['english_text'],
    storeFields: ['id'],
    searchOptions: { combineWith: 'AND', prefix: true, fuzzy: 0.2 },
  });

  strictPhoneticIndex.addAll(phrases);
  broadPhoneticIndex.addAll(phrases);
  englishIndex.addAll(phrases.filter(p => Boolean(p.english_text)));

  return { strictPhoneticIndex, broadPhoneticIndex, englishIndex };
}

/**
 * Verifies that every space-separated query token appears as a contiguous substring
 * in at least one word of the phrase (in any order) whose confidence is >= minConfidence,
 * and computes the matched word indices and matched alignment confidence.
 */
export function evaluatePhoneticSubstringMatch(
  phrase: PhraseRecord,
  queryTokens: string[],
  isBroad: boolean,
  minConfidence: number = 0
): { matchesAll: boolean; matchedWordIndices: number[]; matchedConfidence: number } {
  if (queryTokens.length === 0) {
    return { matchesAll: false, matchedWordIndices: [], matchedConfidence: 0 };
  }

  const matchedSet = new Set<number>();
  const tokenBestConfs: number[] = [];

  for (const qTok of queryTokens) {
    let foundForThisToken = false;
    let bestConfForTok = 0;

    for (let i = 0; i < phrase.words.length; i++) {
      const wObj = phrase.words[i];
      if (minConfidence > 0 && wObj.confidence < minConfidence) {
        continue;
      }
      const wText = isBroad ? toBroadTTH(wObj.word) : wObj.word;
      if (wText.includes(qTok)) {
        foundForThisToken = true;
        matchedSet.add(i);
        if (wObj.confidence > bestConfForTok) {
          bestConfForTok = wObj.confidence;
        }
      }
    }

    if (!foundForThisToken) {
      return { matchesAll: false, matchedWordIndices: [], matchedConfidence: 0 };
    }
    tokenBestConfs.push(bestConfForTok);
  }

  const avgConf =
    tokenBestConfs.reduce((acc, c) => acc + c, 0) / tokenBestConfs.length;

  return {
    matchesAll: true,
    matchedWordIndices: Array.from(matchedSet).sort((a, b) => a - b),
    matchedConfidence: Number(avgConf.toFixed(4)),
  };
}

/**
 * Executes a search across the active SearchMode ('dg', 'tth', or 'english'),
 * applies non-sequential multi-word substring post-filtering for phonetic modes,
 * filters by confidence (<5% hidden by default) and source/collection,
 * computes matched word confidence, and groups/sorts results.
 */
export function searchCorpus(
  rawQuery: string,
  mode: SearchMode,
  indexes: CorpusIndexes,
  phrasesMap: Map<string, PhraseRecord>,
  sourcesMap: Map<string, DocumentMeta>,
  sortBy: SortOption = 'matched_confidence',
  filtersOrHideAnomalies: SearchFilterOptions | boolean = false
): GroupedSearchResult[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const filters: SearchFilterOptions =
    typeof filtersOrHideAnomalies === 'boolean'
      ? { hideAnomalies: filtersOrHideAnomalies, minConfidence: 0.05 }
      : filtersOrHideAnomalies;

  const minConfidence = filters.minConfidence ?? 0.05;
  const hideAnomalies = filters.hideAnomalies ?? false;
  const filterSourceType = filters.sourceType ?? 'all';
  const filterSourceId = filters.sourceId ?? 'all';

  const passesPhraseFilters = (rec: PhraseRecord): boolean => {
    if (hideAnomalies && rec.has_anomalies) return false;
    if (minConfidence > 0 && rec.mean_confidence < minConfidence) return false;
    if (filterSourceId !== 'all' && rec.source_id !== filterSourceId) return false;
    if (filterSourceType !== 'all') {
      const src = sourcesMap.get(rec.source_id);
      if (!src || src.source_type !== filterSourceType) return false;
    }
    return true;
  };

  const resultsMap = new Map<string, ScoredPhraseMatch>();

  if (mode === 'english') {
    const englishHits = indexes.englishIndex.search(trimmed);
    for (const hit of englishHits) {
      const rec = phrasesMap.get(hit.id);
      if (!rec) continue;
      if (!passesPhraseFilters(rec)) continue;
      resultsMap.set(rec.id, {
        ...rec,
        matchType: 'english',
        score: hit.score * 1.5,
        matchedWordIndices: [],
        matchedConfidence: rec.mean_confidence,
      });
    }
  } else {
    const strictQuery =
      mode === 'dg' ? normalizeDGQueryToTTH(trimmed) : normalizeTTHQuery(trimmed);
    const broadQuery = toBroadTTH(strictQuery);

    const strictTokens = strictQuery.split(/\s+/).filter(Boolean);
    const broadTokens = broadQuery.split(/\s+/).filter(Boolean);

    if (strictTokens.length > 0) {
      // 1. Strict Search
      const hasShortToken = strictTokens.some(t => t.length < 3);
      let strictCandidates: PhraseRecord[] = [];

      if (!hasShortToken) {
        const strictHits = indexes.strictPhoneticIndex.search(strictQuery);
        strictCandidates = strictHits
          .map(h => phrasesMap.get(h.id))
          .filter((p): p is PhraseRecord => Boolean(p));
      } else {
        strictCandidates = Array.from(phrasesMap.values());
      }

      for (const rec of strictCandidates) {
        if (!passesPhraseFilters(rec)) continue;
        const evalResult = evaluatePhoneticSubstringMatch(
          rec,
          strictTokens,
          false,
          minConfidence
        );
        if (evalResult.matchesAll) {
          resultsMap.set(rec.id, {
            ...rec,
            matchType: 'strict',
            score: 2.0,
            matchedWordIndices: evalResult.matchedWordIndices,
            matchedConfidence: evalResult.matchedConfidence,
          });
        }
      }

      // 2. Broad Fallback Search
      let broadCandidates: PhraseRecord[] = [];
      const hasShortBroad = broadTokens.some(t => t.length < 3);

      if (!hasShortBroad) {
        const broadHits = indexes.broadPhoneticIndex.search(broadQuery);
        broadCandidates = broadHits
          .map(h => phrasesMap.get(h.id))
          .filter((p): p is PhraseRecord => Boolean(p));
      } else {
        broadCandidates = Array.from(phrasesMap.values());
      }

      for (const rec of broadCandidates) {
        if (resultsMap.has(rec.id)) continue;
        if (!passesPhraseFilters(rec)) continue;

        const evalResult = evaluatePhoneticSubstringMatch(
          rec,
          broadTokens,
          true,
          minConfidence
        );
        if (evalResult.matchesAll) {
          resultsMap.set(rec.id, {
            ...rec,
            matchType: 'broad',
            score: 1.0,
            matchedWordIndices: evalResult.matchedWordIndices,
            matchedConfidence: evalResult.matchedConfidence,
          });
        }
      }
    }
  }

  // Group by source
  const groupedMap = new Map<string, ScoredPhraseMatch[]>();
  for (const match of resultsMap.values()) {
    const list = groupedMap.get(match.source_id);
    if (list) {
      list.push(match);
    } else {
      groupedMap.set(match.source_id, [match]);
    }
  }

  const groupedResults: GroupedSearchResult[] = [];

  for (const [sourceId, matches] of groupedMap.entries()) {
    const source = sourcesMap.get(sourceId) || {
      source_id: sourceId,
      source_type: 'dictionary_collection',
      title: sourceId,
      sort_order: 999,
    };

    matches.sort((a, b) => compareScoredMatches(a, b, sortBy));

    const topConfidence = matches.reduce((acc, m) => {
      const c =
        m.matchType === 'english' ? m.mean_confidence : m.matchedConfidence;
      return Math.max(acc, c);
    }, 0);

    groupedResults.push({
      source,
      matches,
      topConfidence,
    });
  }

  // Sort groups
  if (sortBy === 'matched_confidence') {
    groupedResults.sort((a, b) => {
      if (Math.abs(b.topConfidence - a.topConfidence) > 0.001) {
        return b.topConfidence - a.topConfidence;
      }
      return a.source.sort_order - b.source.sort_order;
    });
  } else if (sortBy === 'phrase_confidence') {
    groupedResults.sort((a, b) => {
      const topA = a.matches.reduce(
        (acc, m) => Math.max(acc, m.mean_confidence),
        0
      );
      const topB = b.matches.reduce(
        (acc, m) => Math.max(acc, m.mean_confidence),
        0
      );
      if (Math.abs(topB - topA) > 0.001) {
        return topB - topA;
      }
      return a.source.sort_order - b.source.sort_order;
    });
  } else if (sortBy === 'shortest_sentence') {
    groupedResults.sort((a, b) => {
      const minA = a.matches.reduce(
        (acc, m) => Math.min(acc, m.words.length),
        Infinity
      );
      const minB = b.matches.reduce(
        (acc, m) => Math.min(acc, m.words.length),
        Infinity
      );
      if (minA !== minB) {
        return minA - minB;
      }
      return a.source.sort_order - b.source.sort_order;
    });
  } else {
    groupedResults.sort((a, b) => a.source.sort_order - b.source.sort_order);
  }

  return groupedResults;
}

/**
 * Pure sorting comparator for two scored phrase matches under a given SortOption.
 */
export function compareScoredMatches(
  a: ScoredPhraseMatch,
  b: ScoredPhraseMatch,
  sortBy: SortOption
): number {
  if (sortBy === 'matched_confidence') {
    // 1. Strict (score=2.0) vs Broad (score=1.0)
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // 2. Matched word confidence descending
    if (Math.abs(b.matchedConfidence - a.matchedConfidence) > 0.001) {
      return b.matchedConfidence - a.matchedConfidence;
    }
    // 3. Whole phrase mean confidence descending
    if (Math.abs(b.mean_confidence - a.mean_confidence) > 0.001) {
      return b.mean_confidence - a.mean_confidence;
    }
    // 4. Loc index ascending
    return a.loc_index - b.loc_index;
  }

  if (sortBy === 'phrase_confidence') {
    if (Math.abs(b.mean_confidence - a.mean_confidence) > 0.001) {
      return b.mean_confidence - a.mean_confidence;
    }
    return a.loc_index - b.loc_index;
  }

  if (sortBy === 'shortest_sentence') {
    // Fewest words first
    if (a.words.length !== b.words.length) {
      return a.words.length - b.words.length;
    }
    // Secondary: matched confidence descending
    if (Math.abs(b.matchedConfidence - a.matchedConfidence) > 0.001) {
      return b.matchedConfidence - a.matchedConfidence;
    }
    return a.loc_index - b.loc_index;
  }

  // Canonical: source loc_index ascending
  return a.loc_index - b.loc_index;
}

/**
 * Flattens all grouped results and sorts them globally across sources.
 */
export function flattenAndSortMatches(
  groupedResults: GroupedSearchResult[],
  sortBy: SortOption,
  sourcesMap: Map<string, DocumentMeta>
): ScoredPhraseMatch[] {
  const allMatches: ScoredPhraseMatch[] = [];
  for (const group of groupedResults) {
    for (const match of group.matches) {
      allMatches.push(match);
    }
  }

  allMatches.sort((a, b) => {
    if (sortBy === 'canonical') {
      const srcA = sourcesMap.get(a.source_id);
      const srcB = sourcesMap.get(b.source_id);
      const sortA = srcA ? srcA.sort_order : 999;
      const sortB = srcB ? srcB.sort_order : 999;
      if (sortA !== sortB) {
        return sortA - sortB;
      }
      return a.loc_index - b.loc_index;
    }
    return compareScoredMatches(a, b, sortBy);
  });

  return allMatches;
}

/**
 * Formats a concise, non-redundant source & location badge for ungrouped cards,
 * avoiding repeating speaker names twice on Saving the Voices cards.
 */
export function formatUngroupedSourceLocation(
  source: DocumentMeta | undefined,
  phrase: PhraseRecord
): { sourceLabel: string; locLabel: string } {
  if (!source) {
    return { sourceLabel: phrase.source_id, locLabel: phrase.loc_label };
  }

  if (source.source_type === 'dictionary_collection') {
    return {
      sourceLabel: '1975 Dictionary',
      locLabel: phrase.loc_label,
    };
  }

  if (source.source_type === 'biblical_chapter') {
    const bookName = source.title.replace(/\s+\d+$/, '');
    return {
      sourceLabel: bookName || source.title,
      locLabel: phrase.loc_label,
    };
  }

  // Saving the Voices: strip "Saving the Voices: " prefix for concise interview title
  const conciseTitle = source.title.replace(/^Saving the Voices:\s*/i, '').trim();
  const baseInterviewName = conciseTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // If loc_label ends with "• <Speaker>" that duplicates the interview title, strip it when ungrouped
  let cleanLoc = phrase.loc_label;
  const bulletIdx = cleanLoc.indexOf('•');
  if (bulletIdx !== -1) {
    const speakerSuffix = cleanLoc.slice(bulletIdx + 1).trim();
    if (
      speakerSuffix.toLowerCase() === baseInterviewName.toLowerCase() ||
      conciseTitle.toLowerCase().includes(speakerSuffix.toLowerCase())
    ) {
      cleanLoc = cleanLoc.slice(0, bulletIdx).trim();
    }
  }

  return {
    sourceLabel: conciseTitle,
    locLabel: cleanLoc,
  };
}
