export type SourceType = 'dictionary_collection' | 'biblical_chapter' | 'marked_syllabary_corpus';

export interface DocumentMeta {
  source_id: string;
  source_type: SourceType;
  title: string;
  sort_order: number;
}

export interface WordAlignment {
  word: string;
  start: number;
  end: number;
  confidence: number;
  flagged: boolean;
}

export interface PhraseRecord {
  id: string;
  source_id: string;
  loc_label: string;
  loc_index: number;
  phonetic_text: string;
  phonetic_broad: string;
  syllabary_text: string;
  english_text: string | null;
  audio_path: string;
  audio_start: number;
  audio_end: number;
  mean_confidence: number;
  min_confidence: number;
  has_anomalies: boolean;
  words: WordAlignment[];
}

export type SearchMode = 'dg' | 'tth' | 'english';

export type SortOption =
  | 'matched_confidence'
  | 'phrase_confidence'
  | 'shortest_sentence'
  | 'canonical';

export interface SearchFilterOptions {
  /**
   * Minimum confidence threshold (default 0.05 = 5%).
   * Phrases with mean_confidence < threshold and phonetic word matches with
   * word.confidence < threshold are hidden unless set to 0.
   */
  minConfidence?: number;
  /** Whether to hide phrases flagged with alignment anomalies. */
  hideAnomalies?: boolean;
  /** Filter by top-level corpus collection ('all' or a specific SourceType). */
  sourceType?: 'all' | SourceType;
  /** Filter by a specific source_id ('all' or a specific source_id). */
  sourceId?: string;
}

export interface ScoredPhraseMatch extends PhraseRecord {
  matchType: 'strict' | 'broad' | 'english';
  score: number;
  matchedWordIndices: number[];
  matchedConfidence: number;
}

export interface GroupedSearchResult {
  source: DocumentMeta;
  matches: ScoredPhraseMatch[];
  topConfidence: number;
}
