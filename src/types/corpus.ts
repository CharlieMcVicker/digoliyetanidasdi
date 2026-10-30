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
  turn_id?: string;
  phrase_index?: number;
  turn_phrase_count?: number;
  speaker_label?: string;
  turn_audio_path?: string | null;
  turn_start_sec?: number;
  turn_end_sec?: number;
  global_start_sec?: number;
  global_end_sec?: number;
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

export interface TurnContainerModel {
  turnId: string;
  turnIndex: number;
  speakerLabel: string;
  englishText: string | null;
  turnAudioPath: string | null;
  turnStartSec: number;
  turnEndSec: number;
  phrases: PhraseRecord[];
  isTargetTurn: boolean;
}

export interface BibleContextWindow {
  kind: 'biblical_chapter';
  source: DocumentMeta;
  targetPhrase: PhraseRecord;
  verses: PhraseRecord[];
  totalVerses: number;
  startIndex: number;
  endIndex: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface InterviewContextWindow {
  kind: 'marked_syllabary_corpus';
  source: DocumentMeta;
  targetPhrase: PhraseRecord;
  targetTurnId: string;
  turns: TurnContainerModel[];
  totalTurns: number;
  startTurnIndex: number;
  endTurnIndex: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export type OrderedSourceContextWindow = BibleContextWindow | InterviewContextWindow;
