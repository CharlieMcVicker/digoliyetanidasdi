import { describe, expect, it } from 'vitest';
import {
  buildOrderedSourceContextWindow,
  buildPhoneticHighlightRegex,
  buildTurnPartCountsMap,
  createCorpusIndexes,
  flattenAndSortMatches,
  formatUngroupedSourceLocation,
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
  {
    source_id: 'stv_0001_toney_cornshucker',
    source_type: 'marked_syllabary_corpus',
    title: 'Saving the Voices: Toney Cornshucker (ᏐᏂ ᏎᎷᏕᏍᎩ)',
    sort_order: 2001,
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
  {
    id: 'stv_0001_toney_cornshucker_seg_0004',
    source_id: 'stv_0001_toney_cornshucker',
    loc_label: 'Seg 004 (0:14) • Toney Cornshucker',
    loc_index: 4,
    phonetic_text: "mhm huh to ulsthanitole truck'i tsitssone",
    phonetic_broad: 'mm u to ulstanitole trucki tsitssone',
    syllabary_text: 'Mhm Huh Ꮩ ᎤᎵᏍᏔᏂᏙᎴ truckᎢ ᏥᏣᏐᏁ',
    english_text: 'Mhm. What happened when the truck hit you?',
    audio_path:
      'https://cherokee-language-hub.kiwadigital.com/content/media/saving-the-voices/0001-sv-toney-cornshucker-r4.mp3',
    audio_start: 14.2,
    audio_end: 18.6,
    mean_confidence: 1.0,
    min_confidence: 1.0,
    has_anomalies: false,
    words: [
      { word: 'mhm', start: 14.2, end: 18.6, confidence: 1.0, flagged: false },
      { word: 'huh', start: 14.2, end: 18.6, confidence: 1.0, flagged: false },
      { word: 'to', start: 14.2, end: 18.6, confidence: 1.0, flagged: false },
      { word: 'ulsthanitole', start: 14.2, end: 18.6, confidence: 1.0, flagged: false },
      { word: "truck'i", start: 14.2, end: 18.6, confidence: 1.0, flagged: false },
      { word: 'tsitssone', start: 14.2, end: 18.6, confidence: 1.0, flagged: false },
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

  it('matches Saving the Voices syncopated and code-switched tokens across strict, broad, and English search', () => {
    // Syncopated token ulsthanitole (from ᎤᎵ,ᏍᏔᏂᏙᎴ)
    const syncRes = searchCorpus('ulsthanitole', 'tth', indexes, phrasesMap, sourcesMap);
    expect(syncRes).toHaveLength(1);
    expect(syncRes[0].matches[0].id).toBe('stv_0001_toney_cornshucker_seg_0004');
    expect(syncRes[0].matches[0].matchType).toBe('strict');
    expect(syncRes[0].matches[0].matchedWordIndices).toEqual([3]);

    // Broad match without aspiration h (ulstanitole)
    const broadRes = searchCorpus('ulstanitole', 'tth', indexes, phrasesMap, sourcesMap);
    expect(broadRes).toHaveLength(1);
    expect(broadRes[0].matches[0].id).toBe('stv_0001_toney_cornshucker_seg_0004');
    expect(broadRes[0].matches[0].matchType).toBe('broad');

    // Code-switched compound clitic truck'i
    const cliticRes = searchCorpus("truck'i", 'tth', indexes, phrasesMap, sourcesMap);
    expect(cliticRes).toHaveLength(1);
    expect(cliticRes[0].matches[0].matchedWordIndices).toEqual([4]);

    // English translation search
    const engRes = searchCorpus('truck hit', 'english', indexes, phrasesMap, sourcesMap);
    expect(engRes).toHaveLength(1);
    expect(engRes[0].matches[0].id).toBe('stv_0001_toney_cornshucker_seg_0004');
  });

  it('hides word matches and phrases with <5% confidence by default and reveals them when minConfidence is 0', () => {
    // In Mark 1:1, the word "yhst" has confidence 0.041 (4.1% < 5%).
    // By default (minConfidence = 0.05), searching for "yhst" excludes this <5% word match:
    const defaultHiddenWord = searchCorpus('yhst', 'tth', indexes, phrasesMap, sourcesMap);
    expect(defaultHiddenWord).toHaveLength(0);

    // Revealing <5% confidence (minConfidence = 0) returns the match on "yhst":
    const revealedWord = searchCorpus(
      'yhst',
      'tth',
      indexes,
      phrasesMap,
      sourcesMap,
      'matched_confidence',
      { minConfidence: 0 }
    );
    expect(revealedWord).toHaveLength(1);
    expect(revealedWord[0].matches[0].id).toBe('nt_mar_01_001');
    expect(revealedWord[0].matches[0].matchedWordIndices).toEqual([1]);

    // Also test a phrase whose overall mean_confidence is < 0.05:
    const lowPhrase: PhraseRecord = {
      ...mockPhrases[0],
      id: 'low_mean_phrase',
      mean_confidence: 0.03,
      min_confidence: 0.01,
    };
    const extendedPhrases = [...mockPhrases, lowPhrase];
    const extIndexes = createCorpusIndexes(extendedPhrases);
    const extMap = new Map(extendedPhrases.map(p => [p.id, p]));

    const hiddenMeanRes = searchCorpus('anichuja', 'dg', extIndexes, extMap, sourcesMap);
    expect(hiddenMeanRes[0].matches.map(m => m.id)).not.toContain('low_mean_phrase');

    const revealedMeanRes = searchCorpus(
      'anichuja',
      'dg',
      extIndexes,
      extMap,
      sourcesMap,
      'matched_confidence',
      { minConfidence: 0 }
    );
    expect(revealedMeanRes[0].matches.map(m => m.id)).toContain('low_mean_phrase');
  });

  it('filters results by sourceType (corpus collection) and specific sourceId', () => {
    // Query "ts" matches words across Dictionary ("anitshutsa"), NT ("tsihsa"), and STV ("tsitssone")
    const allRes = searchCorpus('ts', 'tth', indexes, phrasesMap, sourcesMap);
    expect(allRes.map(g => g.source.source_id).sort()).toEqual([
      'dict_feeling_1975',
      'nt_mar_01',
      'stv_0001_toney_cornshucker',
    ]);

    const onlyDict = searchCorpus(
      'ts',
      'tth',
      indexes,
      phrasesMap,
      sourcesMap,
      'matched_confidence',
      { sourceType: 'dictionary_collection' }
    );
    expect(onlyDict).toHaveLength(1);
    expect(onlyDict[0].source.source_id).toBe('dict_feeling_1975');

    const onlyBible = searchCorpus(
      'ts',
      'tth',
      indexes,
      phrasesMap,
      sourcesMap,
      'matched_confidence',
      { sourceType: 'biblical_chapter' }
    );
    expect(onlyBible).toHaveLength(1);
    expect(onlyBible[0].source.source_id).toBe('nt_mar_01');

    const specificSource = searchCorpus(
      'ts',
      'tth',
      indexes,
      phrasesMap,
      sourcesMap,
      'matched_confidence',
      { sourceId: 'stv_0001_toney_cornshucker' }
    );
    expect(specificSource).toHaveLength(1);
    expect(specificSource[0].source.source_id).toBe('stv_0001_toney_cornshucker');
  });

  it('sorts matches by shortest sentence (fewest words first)', () => {
    // Query "anichuja" matches dict_ex_be81dc927487 (4 words) and dict_ex_test_2 (2 words).
    // With sortBy = 'shortest_sentence', the 2-word sentence comes first:
    const groups = searchCorpus(
      'anichuja',
      'dg',
      indexes,
      phrasesMap,
      sourcesMap,
      'shortest_sentence'
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].matches.map(m => m.id)).toEqual([
      'dict_ex_test_2',
      'dict_ex_be81dc927487',
    ]);
  });

  it('flattens and sorts matches globally across sources when ungrouped', () => {
    const groups = searchCorpus(
      'ts',
      'tth',
      indexes,
      phrasesMap,
      sourcesMap,
      'shortest_sentence'
    );
    const flat = flattenAndSortMatches(groups, 'shortest_sentence', sourcesMap);
    // Word counts: dict_ex_test_2 (2), dict_ex_be81dc927487 (4), stv_0001_toney_cornshucker_seg_0004 (6), nt_mar_01_001 (8)
    expect(flat.map(m => m.id)).toEqual([
      'dict_ex_test_2',
      'dict_ex_be81dc927487',
      'stv_0001_toney_cornshucker_seg_0004',
      'nt_mar_01_001',
    ]);
  });

  it('formats concise non-redundant source and location badges when ungrouped', () => {
    const dictBadge = formatUngroupedSourceLocation(mockSources[0], mockPhrases[0]);
    expect(dictBadge).toEqual({
      sourceLabel: '1975 Dictionary',
      locLabel: 'Entry 0004',
    });

    const bibleBadge = formatUngroupedSourceLocation(mockSources[1], mockPhrases[2]);
    expect(bibleBadge).toEqual({
      sourceLabel: 'Mark',
      locLabel: '1:1',
    });

    const stvBadge = formatUngroupedSourceLocation(mockSources[2], mockPhrases[3]);
    expect(stvBadge).toEqual({
      sourceLabel: 'Toney Cornshucker (ᏐᏂ ᏎᎷᏕᏍᎩ)',
      locLabel: 'Seg 004 (0:14)',
    });
  });

  it('computes multi-part turn counts and builds Interview & Bible context windows', () => {
    const resegmentedStvPhrases: PhraseRecord[] = [
      {
        ...mockPhrases[3],
        id: 'stv_0001_toney_cornshucker_seg-001_p01',
        loc_label: 'Seg 001.1 (0:01) • Charlie Shell',
        loc_index: 101,
        turn_id: 'seg-001',
        phrase_index: 1,
        speaker_label: 'Charlie Shell',
        english_text: 'How are you doing?',
      },
      {
        ...mockPhrases[3],
        id: 'stv_0001_toney_cornshucker_seg-002_p01',
        loc_label: 'Seg 002.1 (0:05) • Toney Cornshucker',
        loc_index: 201,
        turn_id: 'seg-002',
        phrase_index: 1,
        speaker_label: 'Toney Cornshucker',
        english_text: 'I am doing well today, and I went to town this morning.',
        turn_audio_path: 'stv_turn_audio/stv_0001_toney_cornshucker/seg-002.wav',
        turn_start_sec: 5.0,
        turn_end_sec: 22.0,
      },
      {
        ...mockPhrases[3],
        id: 'stv_0001_toney_cornshucker_seg-002_p02',
        loc_label: 'Seg 002.2 (0:14) • Toney Cornshucker',
        loc_index: 202,
        turn_id: 'seg-002',
        phrase_index: 2,
        speaker_label: 'Toney Cornshucker',
        english_text: 'I am doing well today, and I went to town this morning.',
        turn_audio_path: 'stv_turn_audio/stv_0001_toney_cornshucker/seg-002.wav',
        turn_start_sec: 5.0,
        turn_end_sec: 22.0,
      },
      {
        ...mockPhrases[3],
        id: 'stv_0001_toney_cornshucker_seg-003_p01',
        loc_label: 'Seg 003.1 (0:23) • Charlie Shell',
        loc_index: 301,
        turn_id: 'seg-003',
        phrase_index: 1,
        speaker_label: 'Charlie Shell',
        english_text: 'Who did you see there?',
      },
    ];

    const partMap = buildTurnPartCountsMap(resegmentedStvPhrases);
    expect(partMap.get('stv_0001_toney_cornshucker_seg-002_p01')).toEqual({
      turnId: 'seg-002',
      phraseIndex: 1,
      turnPhraseCount: 2,
    });
    expect(partMap.get('stv_0001_toney_cornshucker_seg-002_p02')).toEqual({
      turnId: 'seg-002',
      phraseIndex: 2,
      turnPhraseCount: 2,
    });

    const stvWindow = buildOrderedSourceContextWindow(
      resegmentedStvPhrases[2],
      mockSources[2],
      resegmentedStvPhrases,
      1,
      1
    );
    expect(stvWindow).not.toBeNull();
    expect(stvWindow?.kind).toBe('marked_syllabary_corpus');
    if (stvWindow?.kind === 'marked_syllabary_corpus') {
      expect(stvWindow.turns).toHaveLength(3);
      const targetTurn = stvWindow.turns[1];
      expect(targetTurn.turnId).toBe('seg-002');
      expect(targetTurn.isTargetTurn).toBe(true);
      expect(targetTurn.phrases).toHaveLength(2);
      expect(targetTurn.englishText).toBe(
        'I am doing well today, and I went to town this morning.'
      );
      expect(targetTurn.turnAudioPath).toBe(
        'stv_turn_audio/stv_0001_toney_cornshucker/seg-002.wav'
      );
    }

    // Dictionary returns null context window
    const dictWindow = buildOrderedSourceContextWindow(
      mockPhrases[0],
      mockSources[0],
      mockPhrases,
      3,
      3
    );
    expect(dictWindow).toBeNull();
  });
});
