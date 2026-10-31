---
id: TASK-12
title: Batch align all remaining 12 Saving the Voices interviews on CPU
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 19:47'
updated_date: '2026-10-30 23:29'
labels: []
dependencies: []
modified_files:
  - public/data/phrases.json
  - public/data/sources.json
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Batch align 3 Saving the Voices interviews (0014 Janet Navarro, 0019 Bud Foreman, 0022 Michael Pritchett) planned to complete by ~3:37-3:40 PM (~170 min speech, ~15.7 min compute on CPU).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Align interviews 0014 (Janet Navarro), 0019 (Bud Foreman), and 0022 (Michael Pritchett) on CPU
- [x] #2 Slice standalone phrase WAVs at acoustic pauses and export 7-tier Praat TextGrids
- [x] #3 Rebuild corpus search bundles (phrases.json and sources.json) and pass all tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Launch batch CTC forced alignment on interviews 0014, 0019, 0022 on CPU (~15.7 min compute)
2. Wait for completion at ~3:37 PM
3. Ingest new phrase WAVs with build_corpus.py
4. Run unit and frontend tests and finalize task
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed batch CTC forced alignment across all 12 remaining Saving the Voices interviews (0007, 0008, 0009, 0012, 0014, 0019, 0022, 0051, 0059, 0064, 0076, 0088) totaling 839.45 minutes (~14 hours) of Cherokee speech.

Final Corpus Totals:
- 8,886 new standalone phrase WAVs sliced at acoustic pauses in this batch
- 100% of all 22 transcribed Saving the Voices interviews are now locally aligned (13,857 STV phrases)
- 17,463 total aligned phrases across all 67 corpus sources in public/data/phrases.json
- All 15 Python unit tests, 15 Vitest tests, and Vite production build pass cleanly
<!-- SECTION:FINAL_SUMMARY:END -->
