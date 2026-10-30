import MiniSearch from 'minisearch';
import type {
  BibleContextWindow,
  DocumentMeta,
  GroupedSearchResult,
  InterviewContextWindow,
  OrderedSourceContextWindow,
  PhraseRecord,
  ScoredPhraseMatch,
  SearchFilterOptions,
  SearchMode,
  SortOption,
  TurnContainerModel,
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
  for (const group of groups.values()) {
    group.matches.sort((a, b) => compareScoredMatches(a, b, sortBy, sourcesMap));
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
 * Pure comparator for sorting ScoredPhraseMatch records within a group or across the entire corpus.
 */
export function compareScoredMatches(
  a: ScoredPhraseMatch,
  b: ScoredPhraseMatch,
  sortBy: SortOption,
  sourcesMap?: Map<string, DocumentMeta>
): number {
  if (sortBy === 'canonical') {
    if (a.source_id !== b.source_id && sourcesMap) {
      const srcA = sourcesMap.get(a.source_id);
      const srcB = sourcesMap.get(b.source_id);
      if (srcA && srcB && srcA.sort_order !== srcB.sort_order) {
        return srcA.sort_order - srcB.sort_order;
      }
    }
    return a.loc_index - b.loc_index;
  }

  const matchTierPriority = (m: ScoredPhraseMatch) =>
    m.matchType === 'strict' ? 2 : m.matchType === 'broad' ? 1 : 0;

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
    if (b.matchedConfidence !== a.matchedConfidence) {
      return b.matchedConfidence - a.matchedConfidence;
    }
    return a.loc_index - b.loc_index;
  }

  if (sortBy === 'phrase_confidence') {
    if (b.mean_confidence !== a.mean_confidence) {
      return b.mean_confidence - a.mean_confidence;
    }
    if (b.matchedConfidence !== a.matchedConfidence) {
      return b.matchedConfidence - a.matchedConfidence;
    }
    return a.loc_index - b.loc_index;
  }

  // Default: 'matched_confidence'
  if (b.matchedConfidence !== a.matchedConfidence) {
    return b.matchedConfidence - a.matchedConfidence;
  }
  if (b.mean_confidence !== a.mean_confidence) {
    return b.mean_confidence - a.mean_confidence;
  }
  return a.loc_index - b.loc_index;
}

/**
 * Pure transformation that flattens grouped search results into a single globally
 * sorted list of matches (used when "Group by source" is unchecked).
 */
export function flattenAndSortMatches(
  groupedResults: GroupedSearchResult[],
  sortBy: SortOption,
  sourcesMap: Map<string, DocumentMeta>
): ScoredPhraseMatch[] {
  const flat: ScoredPhraseMatch[] = [];
  for (const g of groupedResults) {
    for (const m of g.matches) {
      flat.push(m);
    }
  }
  return flat.sort((a, b) => compareScoredMatches(a, b, sortBy, sourcesMap));
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
    // phrase.loc_label is e.g. "1:2", so sourceLabel "Matthew" + locLabel "1:2" -> "Matthew • 1:2"
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

/**
 * Derives turn_id and phrase_index for a Saving the Voices PhraseRecord,
 * falling back to parsing `id` or `loc_label` if explicit fields are absent.
 */
export function resolvePhraseTurnIdentity(phrase: PhraseRecord): {
  turnId: string;
  phraseIndex: number;
} {
  if (phrase.turn_id) {
    return {
      turnId: phrase.turn_id,
      phraseIndex: phrase.phrase_index ?? 1,
    };
  }
  const idMatch = phrase.id.match(/_(seg-\d+)_p(\d+)$/i);
  if (idMatch) {
    return {
      turnId: idMatch[1],
      phraseIndex: parseInt(idMatch[2], 10) || 1,
    };
  }
  const segMatch = phrase.id.match(/_seg_(\d+)$/i);
  if (segMatch) {
    return {
      turnId: `seg-${segMatch[1]}`,
      phraseIndex: 1,
    };
  }
  return {
    turnId: phrase.id,
    phraseIndex: 1,
  };
}

/**
 * Computes a lookup map from phrase.id -> { phraseIndex, turnPhraseCount }
 * across all phrases so search cards can show "Part X of Y" even if turn_phrase_count
 * was not pre-baked into JSON.
 */
export function buildTurnPartCountsMap(
  phrases: PhraseRecord[]
): Map<string, { turnId: string; phraseIndex: number; turnPhraseCount: number }> {
  const countsBySourceTurn = new Map<string, PhraseRecord[]>();

  for (const p of phrases) {
    if (!p.source_id.startsWith('stv_')) continue;
    const { turnId } = resolvePhraseTurnIdentity(p);
    const key = `${p.source_id}::${turnId}`;
    const list = countsBySourceTurn.get(key);
    if (list) {
      list.push(p);
    } else {
      countsBySourceTurn.set(key, [p]);
    }
  }

  const result = new Map<
    string,
    { turnId: string; phraseIndex: number; turnPhraseCount: number }
  >();

  for (const group of countsBySourceTurn.values()) {
    group.sort((a, b) => a.loc_index - b.loc_index);
    const total = group.length;
    group.forEach((p, idx) => {
      const { turnId, phraseIndex } = resolvePhraseTurnIdentity(p);
      result.set(p.id, {
        turnId,
        phraseIndex: p.phrase_index ?? phraseIndex ?? idx + 1,
        turnPhraseCount: p.turn_phrase_count ?? total,
      });
    });
  }

  return result;
}

/**
 * Pure transformation that builds a Context Detail window for an ordered source
 * (`biblical_chapter` or `marked_syllabary_corpus`).
 */
export function buildOrderedSourceContextWindow(
  targetPhrase: PhraseRecord,
  source: DocumentMeta,
  allPhrases: PhraseRecord[],
  radiusBefore: number,
  radiusAfter: number
): OrderedSourceContextWindow | null {
  if (source.source_type === 'dictionary_collection') {
    return null;
  }

  const sourcePhrases = allPhrases
    .filter(p => p.source_id === source.source_id)
    .sort((a, b) => a.loc_index - b.loc_index);

  if (sourcePhrases.length === 0) {
    return null;
  }

  if (source.source_type === 'biblical_chapter') {
    const targetIdx = Math.max(
      0,
      sourcePhrases.findIndex(p => p.id === targetPhrase.id)
    );
    const startIndex = Math.max(0, targetIdx - radiusBefore);
    const endIndex = Math.min(sourcePhrases.length - 1, targetIdx + radiusAfter);

    const verses = sourcePhrases.slice(startIndex, endIndex + 1);
    const result: BibleContextWindow = {
      kind: 'biblical_chapter',
      source,
      targetPhrase,
      verses,
      totalVerses: sourcePhrases.length,
      startIndex,
      endIndex,
      hasPrevious: startIndex > 0,
      hasNext: endIndex < sourcePhrases.length - 1,
    };
    return result;
  }

  // Saving the Voices (`marked_syllabary_corpus`): group phrases by turnId in chronological order
  const turnOrder: string[] = [];
  const turnMap = new Map<string, PhraseRecord[]>();

  for (const p of sourcePhrases) {
    const { turnId } = resolvePhraseTurnIdentity(p);
    if (!turnMap.has(turnId)) {
      turnOrder.push(turnId);
      turnMap.set(turnId, []);
    }
    turnMap.get(turnId)!.push(p);
  }

  const { turnId: targetTurnId } = resolvePhraseTurnIdentity(targetPhrase);
  const targetTurnIdx = Math.max(0, turnOrder.indexOf(targetTurnId));
  const startTurnIndex = Math.max(0, targetTurnIdx - radiusBefore);
  const endTurnIndex = Math.min(turnOrder.length - 1, targetTurnIdx + radiusAfter);

  const defaultSpeaker = source.title
    .replace(/^Saving the Voices:\s*/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();

  const turns: TurnContainerModel[] = [];
  for (let i = startTurnIndex; i <= endTurnIndex; i++) {
    const tId = turnOrder[i];
    const tPhrases = turnMap.get(tId) || [];
    const first = tPhrases[0];
    const last = tPhrases[tPhrases.length - 1];

    let speakerLabel = first?.speaker_label || '';
    if (!speakerLabel && first?.loc_label.includes('•')) {
      speakerLabel = first.loc_label.split('•').pop()?.trim() || '';
    }
    if (!speakerLabel) {
      speakerLabel = defaultSpeaker;
    }

    const turnStartSec =
      first?.turn_start_sec ??
      first?.global_start_sec ??
      first?.audio_start ??
      0;
    const turnEndSec =
      last?.turn_end_sec ??
      last?.global_end_sec ??
      last?.audio_end ??
      turnStartSec;

    // Infer turn_audio_path if not explicitly present on local STV recordings
    const isRemote =
      first?.audio_path.startsWith('http://') ||
      first?.audio_path.startsWith('https://');
    const inferredTurnAudioPath =
      first?.turn_audio_path ??
      (!isRemote && tId.startsWith('seg-')
        ? `stv_turn_audio/${source.source_id}/${tId}.wav`
        : isRemote
          ? first.audio_path
          : null);

    turns.push({
      turnId: tId,
      turnIndex: i,
      speakerLabel,
      englishText: first?.english_text ?? null,
      turnAudioPath: inferredTurnAudioPath ?? null,
      turnStartSec,
      turnEndSec,
      phrases: tPhrases,
      isTargetTurn: tId === targetTurnId,
    });
  }

  const result: InterviewContextWindow = {
    kind: 'marked_syllabary_corpus',
    source,
    targetPhrase,
    targetTurnId,
    turns,
    totalTurns: turnOrder.length,
    startTurnIndex,
    endTurnIndex,
    hasPrevious: startTurnIndex > 0,
    hasNext: endTurnIndex < turnOrder.length - 1,
  };
  return result;
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
