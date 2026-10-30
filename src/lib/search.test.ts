import { describe, expect, it } from 'vitest';
import {
  buildPhoneticHighlightRegex,
  createCorpusIndexes,
  normalizeDGQueryToTTH,
  normalizeTTHQuery,
  phoneticNgramTokenizer,
  searchCorpus,
  toBroadTTH,
} from './search';
import type { DocumentMeta, PhraseRecord } from '../types/corpus';

const mockSources: DocumentMeta[] = [
  {
    source_id: 'dict_feeling_1975',
    source_type: 'dictionary_collection',
    title: 'Cherokee Dictionary Examples (1975 Feeling)',
    sort_order: 1000,
  },
  {
    source_id: 'nt_mar_01',
    source_type: 'biblical_chapter',
    title: 'Mark 1',
    sort_order: 201,
  },
];

const mockPhrases: PhraseRecord[] = [
  {
    id: 'dict_ex_be81dc927487',
    source_id: 'dict_feeling_1975',
    loc_label: 'Entry 0004',
    loc_index: 1,
    phonetic_text: 'na anitshutsa hskwalhehsti tananelohvhska',
    phonetic_broad: 'na anitsutsa skwalesti tananelovska',
    syllabary_text: 'Ꮎ ᎠᏂᏧᏣ ᏍᏆᏞᏍᏗ ᏓᎾᏁᎶᎲᏍᎦ.',
    english_text: 'The boys are playing ball.',
    audio_path: 'sentence_audio/Sentence_for_entry_0004.wav',
    audio_start: 0,
    audio_end: 3.714,
    mean_confidence: 0.9794,
    min_confidence: 0.9315,
    has_anomalies: false,
    words: [
      { word: 'na', start: 0.26, end: 0.38, confidence: 0.9884, flagged: false },
      { word: 'anitshutsa', start: 0.48, end: 1.22, confidence: 0.9999, flagged: false },
      { word: 'hskwalhehsti', start: 1.36, end: 2.04, confidence: 0.9315, flagged: false },
      { word: 'tananelohvhska', start: 2.12, end: 3.32, confidence: 0.9979, flagged: false },
    ],
  },
  {
    id: 'dict_ex_test_2',
    source_id: 'dict_feeling_1975',
    loc_label: 'Entry 0099',
    loc_index: 2,
    phonetic_text: 'anitshutsa aninohalidoha',
    phonetic_broad: 'anitsutsa aninoalitoa',
    syllabary_text: 'ᎠᏂᏧᏣ ᎠᏂᏃᎭᎵᏙᎭ.',
    english_text: 'The boys are hunting.',
    audio_path: 'sentence_audio/Sentence_for_entry_0099.wav',
    audio_start: 0,
    audio_end: 2.5,
    mean_confidence: 0.65,
    min_confidence: 0.45,
    has_anomalies: false,
    words: [
      { word: 'anitshutsa', start: 0.1, end: 0.9, confidence: 0.45, flagged: false },
      { word: 'aninohalidoha', start: 1.0, end: 2.4, confidence: 0.85, flagged: false },
    ],
  },
  {
    id: 'nt_mar_01_001',
    source_id: 'nt_mar_01',
    loc_label: '1:1',
    loc_index: 1,
    phonetic_text: 'atalenihskv yhst khanohetv tsihsa kalonetv unelhanvhi uwetsi utselika',
    phonetic_broad: 'ataleniskv yst kanoetv tsisa kalonetv unelanvi uwetsi utselika',
    syllabary_text: 'ᎠᏓᎴᏂᏍᎬ ᏱᏍᏛ ᎧᏃᎮᏛ ᏥᏌ ᎦᎶᏁᏛ ᎤᏁᎳᏅᎯ ᎤᏪᏥ ᎤᏤᎵᎦ.',
    english_text: 'The beginning of the gospel of Jesus Christ, the Son of God;',
    audio_path: 'split_audio/mark_01_01.wav',
    audio_start: 0,
    audio_end: 7.44,
    mean_confidence: 0.7414,
    min_confidence: 0.041,
    has_anomalies: true,
    words: [
      { word: 'atalenihskv', start: 0.1, end: 0.9, confidence: 0.9955, flagged: false },
      { word: 'yhst', start: 1.18, end: 1.5, confidence: 0.041, flagged: true },
      { word: 'khanohetv', start: 1.62, end: 2.36, confidence: 0.4801, flagged: false },
      { word: 'tsihsa', start: 2.92, end: 3.26, confidence: 0.9025, flagged: false },
      { word: 'kalonetv', start: 3.32, end: 3.96, confidence: 0.8693, flagged: false },
      { word: 'unelhanvhi', start: 4.12, end: 4.8, confidence: 0.6493, flagged: false },
      { word: 'uwetsi', start: 4.9, end: 5.42, confidence: 0.9988, flagged: false },
      { word: 'utselika', start: 5.94, end: 6.7, confidence: 0.9944, flagged: false },
    ],
  },
];

describe('Search Normalizers & Tokenizers', () => {
  it('converts D/G queries to canonical TTH using digohwelisgi rules', () => {
    expect(normalizeDGQueryToTTH('ani:chű:ja')).toBe('anitshutsa');
    expect(normalizeDGQueryToTTH('anichuja')).toBe('anitshutsa');
    expect(normalizeDGQueryToTTH('adalenisgv')).toBe('atalenihskv');
    expect(normalizeDGQueryToTTH('sgwà:hle̋:sdi')).toBe('skwalhehsti');
    expect(normalizeDGQueryToTTH('ná sgwà:hle̋:sdi')).toBe('na hskwalhehsti');
  });

  it('normalizes T/TH queries without mutating t->th or k->kh', () => {
    expect(normalizeTTHQuery('anitshutsa')).toBe('anitshutsa');
    expect(normalizeTTHQuery('anitsutsa')).toBe('anitsutsa');
    expect(normalizeTTHQuery('atalenihskv')).toBe('atalenihskv');
  });

  it('generates 3-grams only for words >= 3 chars', () => {
    const tokens = phoneticNgramTokenizer('na anitsutsa');
    expect(tokens).toContain('na');
    expect(tokens).toContain('ani');
    expect(tokens).toContain('nit');
    expect(tokens).toContain('tsa');
    expect(tokens).not.toContain('anitsutsa');
  });
});

describe('Multi-Index Search & Confidence Sorting', () => {
  const indexes = createCorpusIndexes(mockPhrases);
  const phrasesMap = new Map(mockPhrases.map(p => [p.id, p]));
  const sourcesMap = new Map(mockSources.map(s => [s.source_id, s]));

  it('matches D/G query "anichuja" strictly against "anitshutsa" and sorts by matched word confidence', () => {
    const groups = searchCorpus('anichuja', 'dg', indexes, phrasesMap, sourcesMap);
    expect(groups).toHaveLength(1);
    const matches = groups[0].matches;
    expect(matches).toHaveLength(2);
    expect(matches[0].id).toBe('dict_ex_be81dc927487');
    expect(matches[0].matchType).toBe('strict');
    expect(matches[0].matchedConfidence).toBeCloseTo(0.9999, 4);
    expect(matches[1].id).toBe('dict_ex_test_2');
    expect(matches[1].matchedConfidence).toBeCloseTo(0.45, 4);
  });

  it('matches T/TH query "anitsutsa" (without h) via broad fallback', () => {
    const groups = searchCorpus('anitsutsa', 'tth', indexes, phrasesMap, sourcesMap);
    expect(groups).toHaveLength(1);
    expect(groups[0].matches[0].matchType).toBe('broad');
    expect(groups[0].matches[0].matchedWordIndices).toEqual([1]);
  });

  it('supports non-sequential multi-word infix queries like "nohal tshutsa"', () => {
    const groups = searchCorpus('nohal tshutsa', 'tth', indexes, phrasesMap, sourcesMap);
    expect(groups).toHaveLength(1);
    expect(groups[0].matches).toHaveLength(1);
    expect(groups[0].matches[0].id).toBe('dict_ex_test_2');
    expect(groups[0].matches[0].matchedWordIndices).toEqual([0, 1]);
    expect(groups[0].matches[0].matchedConfidence).toBeCloseTo((0.45 + 0.85) / 2, 4);
  });

  it('matches Mark 1:1 with D/G "adalenisgv" or T/TH "atalenihskv"', () => {
    const dgRes = searchCorpus('adalenisgv', 'dg', indexes, phrasesMap, sourcesMap);
    expect(dgRes).toHaveLength(1);
    expect(dgRes[0].matches[0].id).toBe('nt_mar_01_001');
    expect(dgRes[0].matches[0].matchType).toBe('strict');

    const tthRes = searchCorpus('atalenihskv', 'tth', indexes, phrasesMap, sourcesMap);
    expect(tthRes).toHaveLength(1);
    expect(tthRes[0].matches[0].id).toBe('nt_mar_01_001');
    expect(tthRes[0].matches[0].matchType).toBe('strict');
  });

  it('highlights both strict and broad phonetic matches cleanly', () => {
    const regex = buildPhoneticHighlightRegex('anichuja', 'dg');
    expect(regex).not.toBeNull();
    expect('anitshutsa'.replace(regex!, '<mark>$1</mark>')).toBe('<mark>anitshutsa</mark>');
    expect(toBroadTTH('anitshutsa')).toBe('anitsutsa');
  });
});
