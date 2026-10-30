---
id: TASK-5
title: >-
  Phase 3: Saving the Voices corpus ingestion, diacritic-aware
  syllabary-to-phonetics conversion, and remote segment playback
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 16:43'
updated_date: '2026-10-30 16:54'
labels: []
dependencies: []
modified_files:
  - PLAN.md
  - scripts/build_corpus.py
  - scripts/test_build_corpus.py
  - src/App.tsx
  - src/components/PhraseCard.tsx
  - src/lib/search.test.ts
  - public/data/sources.json
  - public/data/phrases.json
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ingest the 22 Saving the Voices Cherokee interviews (~7,530 Cherokee/code-switched segments) that have both Cherokee syllabary text and startMs/endMs audio timestamps.

Convert marked-up syllabary tokens into canonical T/TH phonetics by treating inline punctuation as phonetic diacritics:
- comma (,) = drop preceding vowel (syncope/apocope)
- semicolon (;) = drop preceding vowel and add h
- period (.) = insert h (pre-aspiration/coda aspiration without dropping vowel)
- colon (:) = long vowel (strip colon)
- apostrophe = glottal stop when internal or trailing; strip when word-initial apheresis
- hyphens (-, --) and ellipses (..., …) between syllabary/words = split into separate words (except English stem + hyphen + Syllabary clitic like Bell-Ꭲ -> bell'i)
- Keep English stems lowercase without D/G->T/TH consonant mutation.
- Strip all punctuation and diacritics from displayed syllabary_text while maintaining 1:1 token alignment with phonetic_text and words[].
- Link audio_path directly to remote Kiwa Digital MP3 URLs with audio_start and audio_end, using a native HTML audio segment player in PhraseCard and displaying a Segment Audio (Unaligned) badge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All 22 Saving the Voices transcripts with Cherokee syllabary and startMs/endMs timestamps are ingested into sources.json and phrases.json (~7,530 Cherokee segments, skipping pure-English segments)
- [x] #2 Marked-up syllabary diacritics (comma, semicolon, period, colon, apostrophe, stutter/repair hyphens, and code-switched compound clitics) convert accurately to canonical T/TH phonetics while syllabary_text displays clean punctuation-free tokens in 1:1 correspondence with words[]
- [x] #3 Saving the Voices records link directly to remote Kiwa Digital MP3 URLs with segment audio_start and audio_end, and PhraseCard plays bounded remote audio segments via native HTML audio without CORS errors or full-file downloads
- [x] #4 PhraseCard displays a neutral Segment Audio (Unaligned) badge for unaligned Saving the Voices segments instead of a percentage confidence badge
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Unit tests cover marked-up syllabary-to-T/TH diacritic conversion and frontend search/rendering
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement pure marked-up syllabary-to-T/TH conversion map and segment tokenizer in scripts/build_corpus.py (handling comma syncope, semicolon vowel-drop+h, period pre-aspiration/coda h, colon stripping, apostrophe glottals, stutter/repair/ellipsis word splitting, and English stem + Syllabary clitic compounds)
2. Add build_saving_the_voices_corpus() to scripts/build_corpus.py to ingest the 22 Saving the Voices interviews with Cherokee syllabary and startMs/endMs timestamps, linking remote Kiwa Digital MP3 URLs and generating updated public/data/sources.json and public/data/phrases.json
3. Update src/components/PhraseCard.tsx and src/App.tsx to support bounded remote HTML5 <audio> playback, unaligned segment badges, and corpus statistics
4. Add unit tests for marked-up syllabary conversion and frontend search/rendering, and verify full build and test suite
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Phase 3 Saving the Voices ingestion, diacritic-aware syllabary-to-T/TH conversion, and remote segment audio playback:
- Downloaded saving-the-voices.json and all 66 referenced transcript JSONs into data/saving-the-voices/
- Added convert_marked_token() and convert_marked_segment() in scripts/build_corpus.py to process inline punctuation as phonetic diacritics (, = drop vowel, ; = drop vowel + h, . = add h, : = strip colon, apostrophes = glottal stop or apheresis, hyphens/ellipses = split into separate words while preserving English-Syllabary compound clitics)
- Ingested all 22 Saving the Voices interviews with Cherokee syllabary and startMs/endMs timestamps (7,530 Cherokee segments, 11,136 total corpus phrases across 67 sources)
- Updated PhraseCard.tsx and App.tsx to stream bounded remote MP3 segments via native HTML5 <audio> and display a neutral Segment Audio (Unaligned) badge
- Added Python unit tests (scripts/test_build_corpus.py) and Vitest tests (src/lib/search.test.ts); all tests and production build pass
<!-- SECTION:FINAL_SUMMARY:END -->
