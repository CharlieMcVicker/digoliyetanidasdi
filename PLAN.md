# Cherokee Phonetic Corpus Search & Audio Alignment Tool — Implementation Plan

## 1. System Overview & Architectural Decisions

We are building a zero-backend, client-side corpus search web application for the Cherokee language with synchronized audio waveform playback, live word-level karaoke highlighting, and audio alignment confidence scoring.

### Core Architectural Constraints

* **Frontend Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS + WaveSurfer.js v7 + MiniSearch + Lucide Icons.
* **Search Engine:** Client-side in-memory search using `MiniSearch`. No backend database is required. Total corpus size across all phases is ~3,600+ phrases, which fits in <4 MB of static JSON and executes queries in <5ms in the browser.
* **Three Exclusive Search Inputs & Multi-Index Strategy:**
  The UI provides three dedicated search input boxes that act as exclusive search modes (typing in one box activates that mode and clears/deactivates the others):
  1. **D/G Phonetics Box (`dg` mode):** Accepts standard D/G orthography (with or without tone marks, colons, or hyphens), converts it to canonical T/TH using full `digohwelisgi` consonant respelling (`t->th`, `d->t`, `k->kh`, `g->k`, `ch->tsh`, `j->ts`, `qu->kw`, `dl->tl`, `hn->nh`, `hl->lh`, `hy->yh`, `hw->wh`, `[^ht]s->\1hs`), and searches the **Strict Cherokee Phonetics Index** (2x priority) with fallback to the **Broad Cherokee Phonetics Index** (1x priority).
  2. **T/TH Phonetics Box (`tth` mode):** Accepts T/TH orthography directly (stripping tones/punctuation without mutating `t->th` or `k->kh`), and searches the **Strict Cherokee Phonetics Index** (2x priority) with fallback to the **Broad Cherokee Phonetics Index** (1x priority).
  3. **English Translation Box (`english` mode):** Searches `english_text` via the **English Translation Index** using MiniSearch's whole-word tokenizer with prefix and fuzzy matching enabled.

* **3-Gram Indexing + Non-Sequential Multi-Word Substring Post-Filtering:**
  * Both `strictPhoneticIndex` (`phonetic_text`) and `broadPhoneticIndex` (`phonetic_broad`) tokenize text strictly into **character 3-grams** (or the short token itself if `< 3` characters) rather than whole words, so `combineWith: 'AND'` matches arbitrary infixes/substrings inside polysynthetic Cherokee words.
  * After MiniSearch candidate retrieval (or direct scan for `< 3` char queries), results are **post-filtered** to verify that **every space-separated query word** appears as a contiguous substring in the phrase (`phonetic_text` for Strict, `phonetic_broad` for Broad), without requiring the query words to appear in sequential order (e.g., `"tshutsa nohal"` matches `"anitshutsa aninohalidoha"`).

* **Canonical Phonetic Representation (CTC-Segmentation Output Tokens in T/TH):**
  * All phonetic text stored in `phrases.json` and displayed in the UI uses the **CTC-segmentation output tokens** (`emitted_word` / `reconciled_phonetics` from `digohwelisgi`'s `CTCSegmentationAligner`), normalized to lowercase canonical **T/TH notation**.
  * All tone diacritics, vowel length colons (`:`), hyphens (`-`), and headword asterisks (`*`) are stripped.
  * Glottal stops (`’`, `ʻ`, `ʔ`) are normalized to the standard ASCII single quote (`'`).

* **Audio Alignment Confidence Sorting & Color-Coding:**
  * Every `WordAlignment` stores `confidence: number` (`0.0` to `1.0`) and `flagged: boolean` from CTC forced alignment.
  * Every `PhraseRecord` stores `mean_confidence: number`, `min_confidence: number`, and `has_anomalies: boolean`.
  * **Confidence Sorting:** For phonetic queries (`dg` or `tth`), matches are sorted by the **matched word's alignment confidence** descending (using the average confidence of matched query tokens if multiple words are queried, with `phrase.mean_confidence` as tie-breaker). Users can also toggle sorting between **Matched Word Confidence (Desc)**, **Phrase Confidence (Desc)**, and **Canonical Order**.
  * **Confidence Color-Coding:** Only the **matched query word(s)** and the **phrase confidence badge** are color-coded by confidence (`>= 0.80` green/high, `0.10 - 0.79` amber/mid, `< 0.10` or `flagged` red/low), while non-matching words remain visually neutral until hovered or actively played.

* **Audio Playback, Click-to-Seek & 1:1 Word Highlighting:**
  * Every searchable record (`PhraseRecord`) points to a pre-sliced, standalone `.wav` audio clip starting at `0.0` seconds (served via symlinks inside `public/` pointing to `/Users/julietmcvicker/code/workshop-transcription`).
  * Word-level alignments (`words[]`) are zero-offset relative to the clip start (`0.0` to `audio_end`).
  * Word-level highlighting binds strictly by **1:1 whitespace token array index (`word_idx`)** between `words[]`, `phonetic_text`, and `syllabary_text`.
  * Clicking any individual word `<span data-word-idx={i}>` in either the phonetic or syllabary line mounts/seeks the WaveSurfer player to `words[i].start` and plays from there. Only one phrase plays at a time.

---

## 2. Canonical Data Schemas

All phases output and consume two static JSON artifacts: `public/data/sources.json` (`DocumentMeta[]`) and `public/data/phrases.json` (`PhraseRecord[]`).

```typescript
export type SourceType = 'dictionary_collection' | 'biblical_chapter' | 'marked_syllabary_corpus';

export interface DocumentMeta {
  source_id: string;        // e.g., "dict_feeling_1975", "nt_mat_01"
  source_type: SourceType;
  title: string;            // Display header, e.g., "Cherokee Dictionary Examples (1975 Feeling)"
  sort_order: number;       // Canonical ordering of source groups (e.g., 100..300 for NT, 1000 for Dict)
}

export interface WordAlignment {
  word: string;             // Canonical TTH word token from CTC-segmentation output
  start: number;            // Zero-offset start time in seconds
  end: number;              // Zero-offset end time in seconds
  confidence: number;       // CTC word alignment confidence (0.0 to 1.0)
  flagged: boolean;         // True if low-confidence / anomalous alignment
}

export interface PhraseRecord {
  id: string;               // Unique ID, e.g., "dict_ex_be81dc927487" or "nt_mat_01_001"
  source_id: string;        // Foreign key to DocumentMeta.source_id
  loc_label: string;        // Citation badge, e.g., "Entry 0004" or "1:1"
  loc_index: number;        // Integer for canonical sorting within a group (e.g., verse or entry index)
  phonetic_text: string;    // Space-joined CTC-segmentation output tokens in canonical TTH
  phonetic_broad: string;   // Canonical lowercase TTH with all 'h' and "'" stripped
  syllabary_text: string;   // Clean Cherokee syllabary (1:1 whitespace token aligned with words[])
  english_text: string | null;
  audio_path: string;       // Relative URL/path to isolated phrase audio file
  audio_start: number;      // Always 0.0 for pre-split clips
  audio_end: number;        // Clip duration in seconds
  mean_confidence: number;  // Mean word alignment confidence across words[]
  min_confidence: number;   // Minimum word alignment confidence across words[]
  has_anomalies: boolean;   // True if any word in words[] is flagged
  words: WordAlignment[];   // 1:1 index-aligned with space-delimited tokens in phonetic_text & syllabary_text
}
```

---

## 3. Shared Normalization & Search Utilities

### A. Python Normalization Helpers (Build-Time)

The Python build script runs using the `workshop-transcription` environment and `digohwelisgi` library:

```python
import re
import unicodedata
from digohwelisgi.cherokee.orthography import Orthography, convert_orthography


def normalize_dg_to_canonical_tth(text: str) -> str:
  """Converts Durbin Feeling / D-G orthography into canonical lowercase TTH."""
  if not text:
    return ""
  tth = convert_orthography(
      text,
      source=Orthography.DG,
      target=Orthography.TTH,
      strip_tones=True,
      contextual_preaspiration=True,
  )
  return clean_to_canonical_tth(tth)


def clean_to_canonical_tth(text: str) -> str:
  """Normalizes TTH phonetic text to lowercase canonical TTH.

  Strips tones, colons, hyphens, asterisks, and punctuation. Normalizes glottal
  stops to ASCII single quote ('). Does not mutate t->th or k->kh.
  """
  if not text:
    return ""
  text = unicodedata.normalize("NFD", text)
  text = re.sub(r"[\u0300-\u036f]", "", text)
  text = re.sub(r"\d+", "", text)
  text = text.lower()
  text = re.sub(r"[’ʻʼʔ]", "'", text)
  text = re.sub(r"[*:\-ː.,?!;\"“”()]", "", text)
  return re.sub(r"\s+", " ", text).strip()


def create_broad_tth(canonical_tth: str) -> str:
  """Strips aspiration (h) and glottal stops (') for broad fallback indexing."""
  return canonical_tth.replace("h", "").replace("'", "")


def clean_syllabary(text: str) -> str:
  """Strips headword asterisks and syncope commas from syllabary display strings."""
  if not text:
    return ""
  # Fix OCR split ᎾᎿ Ꭽ -> ᎾᎿ
  text = re.sub(r"ᎾᎿ\s*Ꭽ\s*", "ᎾᎿ ", text)
  text = re.sub(r"[*,]", "", text)
  return re.sub(r"\s+", " ", text).strip()
```

### B. TypeScript Query Normalizers, Multi-Index Engine & Confidence Sorter (Client-Time)

```typescript
import MiniSearch from 'minisearch';

export type SearchMode = 'dg' | 'tth' | 'english';
export type SortOption = 'matched_confidence' | 'phrase_confidence' | 'canonical';

// 1A. Clean TTH input directly (no consonant mutation)
export function normalizeTTHQuery(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\d+/g, '')
    .toLowerCase()
    .replace(/[’ʻʼʔ?]/g, "'")
    .replace(/[*:\-ː,._!;:"“”()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 1B. Convert D/G input -> Canonical TTH (mirrors digohwelisgi.cherokee.orthography)
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

  // Respell consonants in exact digohwelisgi order: t->th before d->t, k->kh before g->k
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
  s = s.replace(/([^ht\s])s/g, '$1hs');
  s = s.replace(/([aeiouv])(?=[aeiouv])/g, "$1'");

  return normalizeTTHQuery(s);
}

export function toBroadTTH(tth: string): string {
  return tth.replace(/[h']/g, '');
}

// 2. 3-Gram Only Tokenizer for Cherokee Substring/Infix Matching
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

// 3. Initialize the Three MiniSearch Indexes
export function createCorpusIndexes(phrases: PhraseRecord[]) {
  const strictPhoneticIndex = new MiniSearch<PhraseRecord>({
    fields: ['phonetic_text'],
    storeFields: ['id'],
    tokenize: phoneticNgramTokenizer,
    searchOptions: { combineWith: 'AND', prefix: false }
  });

  const broadPhoneticIndex = new MiniSearch<PhraseRecord>({
    fields: ['phonetic_broad'],
    storeFields: ['id'],
    tokenize: phoneticNgramTokenizer,
    searchOptions: { combineWith: 'AND', prefix: false }
  });

  const englishIndex = new MiniSearch<PhraseRecord>({
    fields: ['english_text'],
    storeFields: ['id'],
    searchOptions: { combineWith: 'AND', prefix: true, fuzzy: 0.2 }
  });

  strictPhoneticIndex.addAll(phrases);
  broadPhoneticIndex.addAll(phrases);
  englishIndex.addAll(phrases.filter(p => Boolean(p.english_text)));

  return { strictPhoneticIndex, broadPhoneticIndex, englishIndex };
}

// 4. Post-Filtering, Matched Word Confidence Calculation & Source Grouping
export interface ScoredPhraseMatch extends PhraseRecord {
  matchType: 'strict' | 'broad' | 'english';
  score: number;
  matchedWordIndices: number[];
  matchedConfidence: number;
}

export interface GroupedSearchResult {
  source: DocumentMeta;
  matches: ScoredPhraseMatch[];
}
```

---

## Phase 1: Dictionary Examples Pipeline & Core Search UX

### Goal

Ingest the 1975 Durbin Feeling Dictionary Example Sentences (`sentence_audio.csv` from `../workshop-transcription`), run CTC forced alignment across all valid `.wav` files (reusing cached `.npz` emissions and computing missing ones), output `public/data/sources.json` and `public/data/phrases.json`, and build the client-side 3-box search + waveform + confidence color-coding UI.

### Local Data Inventory (Phase 1)

* **Primary Metadata:** `/Users/julietmcvicker/code/workshop-transcription/data/training/processed/sentence_audio.csv` (1,865 rows; columns: `index, sentence_id, audio, syllabary, phonetic, english, source, speaker, notes`).
* **Audio Assets:** `/Users/julietmcvicker/code/workshop-transcription/data/training/processed/sentence_audio/` directory containing 1,840 mono `.wav` files (16,000 Hz, 16-bit PCM, ~3–5s duration), symlinked into `public/sentence_audio`.
* **Cached CTC Emissions:** `/Users/julietmcvicker/code/workshop-transcription/.cache/ctc_emissions/` containing 1,303 pre-computed `Sentence_for_entry_*.npz` matrices.
* **Known Data Anomalies to Filter:**
  * Row index `1405` (`sentence_id: "6089d9d5aa62"`) has null audio, syllabary, and phonetic fields. Drop this row.
  * 17 rows in `sentence_audio.csv` reference `.wav` files not present on disk in `sentence_audio/`. Verify file existence via `Path.exists()` before including in `phrases.json`.

### Step 1.1: Batch Word-Level Forced Alignment & JSON Bundle Generation (`scripts/build_corpus.py`)

1. Iterate over all valid rows in `sentence_audio.csv` whose `.wav` file exists on disk.
2. Convert each row's `phonetic` string (or `syllabary` string) via `digohwelisgi` and run `CTCSegmentationAligner.align_verse_slice()` using `cache_dir="/Users/julietmcvicker/code/workshop-transcription/.cache/ctc_emissions"`. For the ~537 files not yet in the cache, `CherokeeASRModel` computes and caches their `.npz` logits automatically.
3. Extract the CTC-segmentation output tokens (`w.emitted_word or w.word` cleaned to canonical TTH), timestamps (`start`, `end`), `confidence`, and `flagged` status for each word.
4. Reconcile `syllabary_text` whitespace tokens if needed so `len(words) == len(phonetic_text.split(" ")) == len(syllabary_text.split(" "))` holds 100%.
5. Compute `mean_confidence`, `min_confidence`, and `has_anomalies` for each `PhraseRecord`.

### Step 1.2: Frontend Search, Confidence Color-Coding & Audio Waveform UX

1. **Three Exclusive Search Inputs:**
   * Input 1: **D/G Phonetics** (e.g., `anichuja`, `sgi`, `adalenisgv`)
   * Input 2: **T/TH Phonetics** (e.g., `anitshutsa`, `ski`, `atalenihskv`)
   * Input 3: **English Translation** (e.g., `playing ball`, `roosters`)
   * Typing in any input sets it as the active search mode and clears the other two inputs.
2. **Empty State:**
   * When all inputs are empty, display corpus statistics (total phrases, total audio duration, mean alignment confidence, source count) and clickable example query chips for each of the 3 search boxes.
3. **Confidence Sorting & Filtering Controls:**
   * Sort dropdown: `Matched Word Confidence (High → Low)` (default), `Phrase Confidence (High → Low)`, `Canonical Order`.
   * Filter toggle: `All Results` vs. `High Confidence Only (Hide Flagged)`.
4. **Confidence Color-Coding & Highlighting:**
   * Each phrase card header displays its citation badge (`Entry 0004` or `Mark 1:1`), match type badge (`Strict`, `Broad`, `English`), and a **Phrase Confidence Badge** color-coded by `mean_confidence` (`>= 0.80` emerald/green, `0.10 - 0.79` amber, `< 0.10` rose/red).
   * Inside the phrase text, split `phonetic_text` and `syllabary_text` on whitespace (`/\s+/`) so each word is wrapped in `<span data-word-idx={i}>`.
   * **Matched Query Words:** Words in `matchedWordIndices` receive a confidence-colored pill/border (`>= 0.80` green, `0.10 - 0.79` amber, `< 0.10` red) with `<mark>` highlighting on the matching character sequence, plus a small confidence indicator.
   * **Non-Matching Words:** Remain visually clean/neutral until hovered (showing a tooltip with word confidence & timestamp) or actively spoken during audio playback.
5. **WaveSurfer.js Playback & Click-to-Seek:**
   * Clicking the **Play** button or clicking any word `<span data-word-idx={i}>` in either `phonetic_text` or `syllabary_text` mounts/loads WaveSurfer.js for that phrase (stopping any previously playing phrase), seeks to `words[i].start` (if a word was clicked), and begins playback.
   * During playback, the active word index `activeIdx` is highlighted simultaneously on both the `phonetic_text` line and the `syllabary_text` line.

---

## Phase 2: New Testament Integration

### Goal

Expand `scripts/build_corpus.py` to ingest the 1,749 aligned Cherokee New Testament verses (`bible_alignment_records.json`), using the CTC-segmentation output tokens (`emitted_word` / `reconciled_phonetics`), zero-offsetting word timestamps to match `split_audio/*.wav`, and ensuring 1:1 syllabary token alignment across all 1,749 verses.

### Step 2.1: New Testament Ingestion & 1:1 Syllabary Reconciliation

1. Load `/Users/julietmcvicker/code/workshop-transcription/data/projects/cherokee_new_testament/alignments/bible_alignment_records.json` and symlink `split_audio/` into `public/split_audio`.
2. For each verse, extract zero-offset word intervals (`start - verse_start_sec`, `end - verse_start_sec`), `confidence`, `flagged`, and use the CTC-segmentation output token (`clean_to_canonical_tth(w.get("emitted_word") or w.get("word"))`).
3. Normalize the `ᎾᎿ Ꭽ` -> `ᎾᎿ` OCR artifact in `cherokee_syllabary`, and for the remaining 13 verses where `len(syllabary_words) != len(words)`, use `digohwelisgi`'s character-syllable alignment (`align_character_syllable`) to split/merge the syllabary tokens into exact 1:1 correspondence with `words[]`.

---

## Phase 3: Marked-Up Syllabary Corpus Ingestion (Syncope & Code-Switching)

*(Deferred until web scraping / source ingestion step after Phases 1 and 2 are complete.)*
