---
id: TASK-12
title: Batch align all remaining 12 Saving the Voices interviews on CPU
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 19:47'
updated_date: '2026-10-30 20:47'
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
Batch aligned interviews 0014 (Janet Navarro), 0019 (Bud Foreman), and 0022 (Michael Pritchett) on CPU.

Key Metrics:
- Speech Duration: 169.65 min across 807 turns
- Standalone Phrases Generated: 1,789 phrase WAVs sliced at acoustic pauses
- Praat TextGrids (7-tier) and manifests exported for all 3 interviews
- Ingested into public/data/phrases.json: corpus now has 15,557 total searchable phrases (7,338 locally aligned STV phrases across 17 interviews)
- All 15 Python unit tests, 15 Vitest frontend tests, and Vite build pass cleanly.
<!-- SECTION:FINAL_SUMMARY:END -->
