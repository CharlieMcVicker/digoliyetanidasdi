---
id: TASK-16
title: >-
  Batch align final 4 Saving the Voices interviews (0059, 0064, 0076, 0088) to
  complete corpus
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 22:54'
updated_date: '2026-10-30 23:28'
labels: []
dependencies: []
modified_files:
  - public/data/phrases.json
  - public/data/sources.json
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align the final 4 remaining Saving the Voices interviews with Cherokee syllabary transcripts (0059 Lucy Anderson & Emma Falling, 0064 Felix & Leroy Sanders, 0076 Randy Duncan, 0088 Bobby Pettit 2) totaling ~287 min speech on CPU, export phrase WAVs and Praat TextGrids, rebuild corpus index, and verify all tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Batch align interviews 0059, 0064, 0076, and 0088 using CTC forced alignment on CPU
- [x] #2 Slice standalone phrase WAVs at acoustic pauses and export 7-tier Praat TextGrids
- [x] #3 Rebuild corpus search bundles (sources.json and phrases.json) so 100% of transcribed STV interviews (22/22) are locally aligned
- [x] #4 Pass all Python unit tests, Vitest tests, and Vite production build
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Launch batch CTC forced alignment on interviews 0059, 0064, 0076, 0088 on CPU with shared ASR model instance
2. Slice phrase WAVs at acoustic pauses and export 7-tier Praat TextGrids
3. Ingest all 22 locally aligned interviews with build_corpus.py
4. Run full test suites (Python unittest, Vitest, Vite build) and record final corpus metrics
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
100% of the Saving the Voices transcribed corpus is now fully aligned and integrated!

Final Batch Results (0059, 0064, 0076, 0088):
- 3,210 phrase WAVs sliced at acoustic pauses from 287.18 min speech
- 7-tier Praat TextGrids and manifests exported for all 4

Full Corpus Milestones:
- 22 out of 22 Saving the Voices transcribed interviews are locally aligned with word-level timestamps and syncope/intrusion handling
- 11,951 standalone phrase WAVs across Saving the Voices
- Total searchable phrases across all collections (1975 Feeling Dictionary, New Testament, Saving the Voices): 17,463 phrases
- All 15 Python unit tests, 15 Vitest search engine tests, and Vite production build pass cleanly.
<!-- SECTION:FINAL_SUMMARY:END -->
