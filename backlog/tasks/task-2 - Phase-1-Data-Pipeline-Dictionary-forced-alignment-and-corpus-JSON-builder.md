---
id: TASK-2
title: 'Phase 1 Data Pipeline: Dictionary forced alignment and corpus JSON builder'
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 15:59'
updated_date: '2026-10-30 16:12'
labels: []
dependencies:
  - TASK-1
modified_files:
  - scripts/build_corpus.py
  - public/data/sources.json
  - public/data/phrases.json
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the Python ingestion and CTC forced-alignment pipeline leveraging ../workshop-transcription and digohwelisgi to align all valid 1975 Durbin Feeling Dictionary audio sentences, extract CTC-segmentation output tokens and word/phrase confidence metrics, and generate public/data/sources.json and public/data/phrases.json with symlinked audio assets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All valid dictionary .wav files in sentence_audio.csv are aligned via CTCSegmentationAligner (reusing cached .npz logits where available and computing missing ones)
- [x] #2 Each PhraseRecord contains CTC-segmentation output tokens, word-level start/end/confidence/flagged fields, and phrase-level mean_confidence/min_confidence/has_anomalies
- [x] #3 1:1 token count correspondence holds between words[], phonetic_text, and syllabary_text across all generated dictionary records
- [x] #4 public/data/sources.json, public/data/phrases.json, and public/sentence_audio symlink are generated and verified
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify Python environment with Python >=3.10 in workshop-transcription
2. Write scripts/build_corpus.py to align all valid dictionary sentences using CTCSegmentationAligner (reusing cached .npz logits and computing missing ones)
3. Extract CTC-segmentation output tokens, confidence metrics, and ensure 1:1 syllabary alignment
4. Symlink sentence_audio into public/sentence_audio and verify generated JSON files
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built scripts/build_corpus.py using the toneless Pre-Bible Cherokee ASR model (charliemcvicker/length-only-20260704-155307-asr-cherokee-colon @ 76e62140955f4738abdab345ea34068b02d8d2a2).
- Aligned all 1,857 valid dictionary sentences with CTCSegmentationAligner
- Extracted CTC-segmentation output tokens, word-level start/end/confidence/flagged fields, and phrase-level mean_confidence/min_confidence/has_anomalies
- Verified 100% 1:1 token correspondence between words[], phonetic_text, and syllabary_text
- Generated public/data/sources.json, public/data/phrases.json, and audio symlinks
<!-- SECTION:FINAL_SUMMARY:END -->
