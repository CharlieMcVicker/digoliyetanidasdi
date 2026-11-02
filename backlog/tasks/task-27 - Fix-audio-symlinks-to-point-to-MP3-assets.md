---
id: TASK-27
title: Fix audio symlinks to point to MP3 assets
status: Done
assignee:
  - '@self'
created_date: '2026-11-02 18:34'
updated_date: '2026-11-02 18:35'
labels: []
dependencies: []
modified_files:
  - scripts/build_corpus.py
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When build_corpus.py was updated to generate .mp3 paths in public/data/phrases.json (commit 53b2477), the public/ audio symlinks (sentence_audio, split_audio, stv_audio, stv_turn_audio) were still left pointing to the raw WAV directories. Because the client requests .mp3, Vite dev server serves 404 (or index.html SPA fallback), causing WaveSurfer MediaError code 4 ("Failed to init decoder"). Update ensure_audio_symlinks in scripts/build_corpus.py to point to audio_mp3 directories, re-link, and verify HTTP audio streaming.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ensure_audio_symlinks in scripts/build_corpus.py links public/ directories to audio_mp3/ directories
- [x] #2 public/ audio symlinks correctly resolve .mp3 requests with audio/mpeg content type
- [x] #3 curl test verifies MP3 byte serving for Bible, dictionary, and STV audio
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect and update ensure_audio_symlinks in scripts/build_corpus.py to point to audio_mp3/
2. Run ensure_audio_symlinks to update public/ symlinks
3. Curl test the Vite dev server for .mp3 files across all categories
4. Verify tests and close task
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated ensure_audio_symlinks in scripts/build_corpus.py to point public/ audio symlinks (sentence_audio, split_audio, stv_audio, stv_turn_audio) to audio_mp3/. Re-linked symlinks and verified that Vite dev server correctly serves .mp3 files as audio/mpeg across New Testament, Dictionary, and Saving the Voices segments.
<!-- SECTION:FINAL_SUMMARY:END -->
