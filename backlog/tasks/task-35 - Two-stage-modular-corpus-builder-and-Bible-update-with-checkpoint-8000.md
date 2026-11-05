---
id: TASK-35
title: Two-stage modular corpus builder and Bible update with checkpoint-8000
status: Done
assignee:
  - '@self'
created_date: '2026-11-04 18:18'
updated_date: '2026-11-04 18:25'
labels: []
dependencies: []
modified_files:
  - scripts/build_corpus.py
  - scripts/test_build_corpus.py
  - public/data/sources.json
  - public/data/phrases.json
  - .gitignore
  - README.md
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Support modular per-source index generation and merging (stage 1 per-source caching, stage 2 unification) with selective --recompute flags. Ingest realigned Cherokee New Testament data from checkpoint-8000 across all 5 books (Matthew, Mark, Philippians, Titus, Philemon), reslice audio WAVs, encode speech-optimized MP3s, and rebuild public search indexes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Refactor scripts/build_corpus.py into a two-stage build pipeline with per-source intermediate caching and --recompute <source> CLI flag
- [x] #2 Update Bible ingestion to support all 5 books with unique codes (mat, mar, php, tit, phm), canonical NT sort order, and book_transcripts English lookup
- [x] #3 Reslice all 1,924 verses via scripts/reslice_bible.py and encode 48kbps mono MP3s via scripts/convert_to_mp3.py
- [x] #4 Execute build_corpus.py with --recompute bible to merge cached dictionary and STV with updated Bible into public/data/
- [x] #5 Verify vitest search suite and python unit tests pass with zero regressions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Refactor scripts/build_corpus.py to introduce a two-stage architecture: Stage 1 builds or loads intermediate JSON artifacts per source (dictionary, bible, stv) stored under data/intermediate/; Stage 2 merges and sorts sources and phrases into public/data/.
2. Add --recompute [all|bible|dictionary|stv] CLI option, defaulting to reading intermediate cache if present, and extracting existing public/data records if intermediate files do not yet exist.
3. Update build_bible_corpus to handle Matthew, Mark, Philippians, Titus, Philemon with non-colliding book codes, NT order, and book_transcripts English fallback.
4. Run scripts/reslice_bible.py to extract all 1,924 verse WAVs from continuous MP3s in workshop-transcription.
5. Run scripts/convert_to_mp3.py --target split_audio to produce speech-optimized MP3s in audio_mp3/split_audio.
6. Run scripts/build_corpus.py --recompute bible to build the new Bible bundle and merge all sources.
7. Run tests (npm test and scripts/test_build_corpus.py) and verify search/playback integrity.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refactored scripts/build_corpus.py into a modular two-stage pipeline with per-source intermediate caching (under data/intermediate/) and --recompute <collection> CLI flags.

Re-sliced and ingested the newly realigned Cherokee New Testament (checkpoint-8000) across all 5 books (Matthew, Mark, Philippians, Titus, Philemon):
1. Slice & MP3 Encoding: Sliced all 1,924 verses to 16kHz WAVs and converted to speech-optimized 48kbps mono MP3s in audio_mp3/split_audio.
2. Two-Stage Pipeline & Ingestion: Stage 1 builds or loads cached intermediate collection artifacts (dictionary.json, bible.json, stv.json), enabling selective recomputation via `--recompute [bible|dictionary|stv|all]`. Stage 2 merges intermediate bundles into public/data/.
3. Book Codes & English Lookups: Mapped non-colliding canonical book codes (mat, mar, php, tit, phm), canonical NT sort ordering, and added fallback to book_transcripts/<book>_<ch>.json to guarantee 100% complete English translations across all 1,924 verses.
4. Verification: 16 Vitest unit tests, 18 Python unit tests, and production Vite TypeScript build all passed with zero regressions.
<!-- SECTION:FINAL_SUMMARY:END -->
