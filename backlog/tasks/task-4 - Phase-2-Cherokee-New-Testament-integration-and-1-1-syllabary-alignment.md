---
id: TASK-4
title: 'Phase 2: Cherokee New Testament integration and 1:1 syllabary alignment'
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 15:59'
updated_date: '2026-10-30 16:12'
labels: []
dependencies:
  - TASK-2
modified_files:
  - scripts/build_corpus.py
  - public/data/sources.json
  - public/data/phrases.json
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expand scripts/build_corpus.py to ingest the 1,749 aligned Cherokee New Testament verses from bible_alignment_records.json using CTC-segmentation output tokens, zero-offsetting word timestamps to match split_audio/*.wav, and reconciling the 108 syllabary whitespace discrepancies so 1:1 word_idx alignment holds across all verses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 sources.json includes all 44 New Testament chapters and phrases.json includes all 1,749 verses alongside Dictionary examples
- [x] #2 All NT word timestamps are zero-offset relative to split_audio/*.wav clips and carry CTC-segmentation output tokens and confidence scores
- [x] #3 All 1,749 NT verses have exact 1:1 whitespace token correspondence between words[], phonetic_text, and syllabary_text
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ingest all 1,749 New Testament verses from bible_alignment_records.json in scripts/build_corpus.py
2. Zero-offset word timestamps and extract CTC-segmentation output tokens and confidence metrics
3. Reconcile the 108 syllabary whitespace discrepancies using align_character_syllable_detailed and verify 1:1 alignment
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ingested all 1,749 Cherokee New Testament verses across 44 chapters in scripts/build_corpus.py.
- Zero-offset all word timestamps relative to split_audio/*.wav clips and preserved CTC-segmentation output tokens and confidence scores
- Reconciled all 108 syllabary whitespace discrepancies (including ᎾᎿ Ꭽ -> ᎾᎿ and character-syllable alignment) and verified 100% 1:1 correspondence across all 3,606 corpus phrases
<!-- SECTION:FINAL_SUMMARY:END -->
