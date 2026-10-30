---
id: TASK-1
title: >-
  Update PLAN.md with resolved architectural, search, and confidence
  specifications
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 15:59'
updated_date: '2026-10-30 16:00'
labels: []
dependencies: []
modified_files:
  - PLAN.md
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update PLAN.md to capture all decisions resolved during design alignment, including the three-box search interface (D/G, T/TH, English), 3-gram-only phonetic indexing with per-word substring post-filtering, CTC-segmentation output token alignment, and word/phrase confidence scoring and color-coding.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PLAN.md documents the three exclusive search inputs (D/G, T/TH, English) and real D/G -> T/TH normalization rules
- [x] #2 PLAN.md documents 3-gram-only phonetic indexing and multi-word non-sequential substring post-filtering
- [x] #3 PLAN.md documents WordAlignment and PhraseRecord confidence fields, confidence-based sorting, and confidence color-coding for matched words and phrase badges
- [x] #4 PLAN.md documents CTC-segmentation output tokens and 1:1 syllabary alignment reconciliation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update PLAN.md with three-box search architecture, real D/G -> T/TH normalization rules, and 3-gram-only indexing + substring post-filtering
2. Document WordAlignment and PhraseRecord confidence fields, sorting by matched word confidence, and confidence color-coding
3. Document CTC-segmentation output token alignment and 1:1 syllabary reconciliation
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated PLAN.md with resolved specifications:
- Three exclusive search inputs (D/G, T/TH, English) and digohwelisgi consonant respelling rules
- 3-gram-only phonetic indexing with non-sequential multi-word substring post-filtering
- WordAlignment and PhraseRecord confidence metrics, sorting by matched word confidence, and confidence color-coding for matched query words and phrase badges
- CTC-segmentation output token representation and 1:1 syllabary alignment reconciliation
<!-- SECTION:FINAL_SUMMARY:END -->
