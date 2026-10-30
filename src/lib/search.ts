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

/**
 * Normalizes a T/TH query string to lowercase canonical TTH without mutating
 * consonants (does not turn t -> th or k -> kh).
 */
export function normalizeTTHQuery(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\d+/g, '')
    .toLowerCase()
    .replace(/[’ʻʼʔ?]/g, "'")
    .replace(/[*:\-ː,._!;:"“”()‚]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts a D/G query string into canonical lowercase TTH using the exact
 * digohwelisgi consonant respelling rules:
 *   qu -> gw, tl -> dl
 *   t(?!s) -> th, d -> t, k -> kh, g -> k, j -> ts, ch -> tsh
 *   hn -> nh, hl -> lh, hy -> yh, hw -> wh
 *   sl(?=[aeiouv]) -> slh, ([^ht\s])s -> \1hs, vowel hiatus -> '
 */
export function normalizeDGQueryToTTH(raw: string): string {
  if (!raw) return '';
  let s = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\d+/g, '')
    .replace(/[:ː\-]/g, '')
    .toLowerCase()
    .replace(/qu/g, 'gw')
    .replace(/tl/g, 'dl');

  s = s.replace(/t(?!s)/g, 'th');
  s = s
    .replace(/d/g, 't')
    .replace(/k/g, 'kh')
    .replace(/g/g, 'k')
    .replace(/j/g, 'ts')
    .replace(/ch/g, 'tsh')
    .replace(/hn/g, 'nh')
    .replace(/hl/g, 'lh')
    .replace(/hy/g, 'yh')
    .replace(/hw/g, 'wh')
    .replace(/[?’ʻʼʔ]/g, "'");

  s = s.replace(/sl(?=[aeiouv])/g, 'slh');
  s = s.replace(/([^ht])s/g, '$1hs');
  s = s.replace(/([aeiouv])(?=[aeiouv])/g, "$1'");

  return normalizeTTHQuery(s);
}

/**
 * Strips aspiration ('h') and glottal stops ("'") for broad phonetic fallback.
 */
export function toBroadTTH(tth: string): string {
  return tth.replace(/[h']/g, '');
}

/**
 * 3-gram-only tokenizer for Cherokee phonetic substring/infix matching.
 * Words shorter than 3 characters are emitted as-is.
 */
export function phoneticNgramTokenizer(text: string): string[] {
  if (!text) return [];
  const normalized = text.toLowerCase().trim();
  const tokens = new Set<string>();
  const words = normalized.split(/\s+/).filter(Boolean);

  for (const w of words) {
    if (w.length < 3) {
      tokens.add(w);
    } else {
      for (let i = 0; i <= w.length - 3; i++) {
        tokens.add(w.substring(i, i + 3));
      }
    }
  }
  return Array.from(tokens);
}

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

    const strictQueryTokens = strictQuery.split(/\s+/).filter(Boolean);
    const broadQueryTokens = broadQuery.split(/\s+/).filter(Boolean);

    // 1. Strict Phonetic Candidates
    if (strictQueryTokens.length > 0) {
      const hasShortToken = strictQueryTokens.some(t => t.length < 3);
      const strictCandidateIds: Array<{ id: string; score: number }> = hasShortToken
        ? Array.from(phrasesMap.values()).map(p => ({ id: p.id, score: 1.0 }))
        : indexes.strictPhoneticIndex.search(strictQuery).map(h => ({ id: h.id, score: h.score }));

      for (const cand of strictCandidateIds) {
        const rec = phrasesMap.get(cand.id);
        if (!rec) continue;
        if (!passesPhraseFilters(rec)) continue;

        const evalRes = evaluatePhoneticSubstringMatch(
          rec,
          strictQueryTokens,
          false,
          minConfidence
        );
        if (evalRes.matchesAll) {
          resultsMap.set(rec.id, {
            ...rec,
            matchType: 'strict',
            score: cand.score * 2,
            matchedWordIndices: evalRes.matchedWordIndices,
            matchedConfidence: evalRes.matchedConfidence,
          });
        }
      }
    }

    // 2. Broad Phonetic Candidates (Fallback)
    if (broadQueryTokens.length > 0) {
      const hasShortBroad = broadQueryTokens.some(t => t.length < 3);
      const broadCandidateIds: Array<{ id: string; score: number }> = hasShortBroad
        ? Array.from(phrasesMap.values()).map(p => ({ id: p.id, score: 1.0 }))
        : indexes.broadPhoneticIndex.search(broadQuery).map(h => ({ id: h.id, score: h.score }));

      for (const cand of broadCandidateIds) {
        if (resultsMap.has(cand.id)) continue;
        const rec = phrasesMap.get(cand.id);
        if (!rec) continue;
        if (!passesPhraseFilters(rec)) continue;

        const evalRes = evaluatePhoneticSubstringMatch(
          rec,
          broadQueryTokens,
          true,
          minConfidence
        );
        if (evalRes.matchesAll) {
          resultsMap.set(rec.id, {
            ...rec,
            matchType: 'broad',
            score: cand.score,
            matchedWordIndices: evalRes.matchedWordIndices,
            matchedConfidence: evalRes.matchedConfidence,
          });
        }
      }
    }
  }

  // Group by source_id
  const groups = new Map<string, GroupedSearchResult>();
  for (const match of resultsMap.values()) {
    const source = sourcesMap.get(match.source_id);
    if (!source) continue;
    if (!groups.has(match.source_id)) {
      groups.set(match.source_id, {
        source,
        matches: [],
        topConfidence: 0,
      });
    }
    const group = groups.get(match.source_id)!;
    group.matches.push(match);
    if (match.matchedConfidence > group.topConfidence) {
      group.topConfidence = match.matchedConfidence;
    }
  }

  // Sort matches within each group
  const matchTierPriority = (m: ScoredPhraseMatch) =>
    m.matchType === 'strict' ? 2 : m.matchType === 'broad' ? 1 : 0;

  for (const group of groups.values()) {
    group.matches.sort((a, b) => {
      if (sortBy === 'canonical') {
        return a.loc_index - b.loc_index;
      }

      // Always keep Strict matches above Broad fallback matches
      const tierDiff = matchTierPriority(b) - matchTierPriority(a);
      if (tierDiff !== 0) return tierDiff;

      if (sortBy === 'shortest_sentence') {
        if (a.words.length !== b.words.length) {
          return a.words.length - b.words.length;
        }
        if (a.phonetic_text.length !== b.phonetic_text.length) {
          return a.phonetic_text.length - b.phonetic_text.length;
        }
        return b.matchedConfidence - a.matchedConfidence;
      }

      if (sortBy === 'phrase_confidence') {
        if (b.mean_confidence !== a.mean_confidence) {
          return b.mean_confidence - a.mean_confidence;
        }
        return b.matchedConfidence - a.matchedConfidence;
      }

      // Default: 'matched_confidence'
      if (b.matchedConfidence !== a.matchedConfidence) {
        return b.matchedConfidence - a.matchedConfidence;
      }
      if (b.mean_confidence !== a.mean_confidence) {
        return b.mean_confidence - a.mean_confidence;
      }
      return a.loc_index - b.loc_index;
    });
  }

  // Sort source groups
  return Array.from(groups.values()).sort((a, b) => {
    if (sortBy === 'canonical') {
      return a.source.sort_order - b.source.sort_order;
    }
    if (sortBy === 'shortest_sentence') {
      const aMinWords = Math.min(...a.matches.map(m => m.words.length));
      const bMinWords = Math.min(...b.matches.map(m => m.words.length));
      if (aMinWords !== bMinWords) {
        return aMinWords - bMinWords;
      }
      const aMinChars = Math.min(...a.matches.map(m => m.phonetic_text.length));
      const bMinChars = Math.min(...b.matches.map(m => m.phonetic_text.length));
      if (aMinChars !== bMinChars) {
        return aMinChars - bMinChars;
      }
    }
    if (b.topConfidence !== a.topConfidence) {
      return b.topConfidence - a.topConfidence;
    }
    return a.source.sort_order - b.source.sort_order;
  });
}

/**
 * Builds a character-sequence RegExp that highlights each query token inside a
 * phonetic word (allowing optional 'h' or "'" between characters so both Strict
 * and Broad matches highlight cleanly).
 */
export function buildPhoneticHighlightRegex(
  rawQuery: string,
  mode: SearchMode
): RegExp | null {
  if (mode === 'english') return null;
  const strictQuery =
    mode === 'dg' ? normalizeDGQueryToTTH(rawQuery) : normalizeTTHQuery(rawQuery);
  const broadTokens = toBroadTTH(strictQuery)
    .split(/\s+/)
    .filter(Boolean);
  if (broadTokens.length === 0) return null;

  // Sort longer tokens first so overlapping prefixes match greedily
  const patterns = [...broadTokens]
    .sort((a, b) => b.length - a.length)
    .map(tok =>
      tok
        .split('')
        .map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join("[h']*")
    );

  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

/**
 * Builds a RegExp for highlighting English search query terms.
 */
export function buildEnglishHighlightRegex(rawQuery: string): RegExp | null {
  const tokens = rawQuery
    .trim()
    .split(/\s+/)
    .map(t => t.replace(/[^\w']/g, ''))
    .filter(t => t.length >= 2);
  if (tokens.length === 0) return null;

  const patterns = [...tokens]
    .sort((a, b) => b.length - a.length)
    .map(tok => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return new RegExp(`(${patterns.join('|')})`, 'gi');
}
