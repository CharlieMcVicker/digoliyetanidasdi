---
id: TASK-9
title: 'Batch align Saving the Voices interviews (0001, 0004, 0006, 0010)'
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 19:16'
updated_date: '2026-10-30 19:46'
labels: []
dependencies: []
modified_files:
  - public/data/phrases.json
  - public/data/sources.json
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Execute CTC forced alignment across the next 4 Saving the Voices interviews (0001 Toney Cornshucker, 0004 Jerry & Mary Scott, 0006 Edward Bunch & Mack Flynn, 0010 Mary McCoy) with pause-based phrase slicing, Praat TextGrid export, and corpus index rebuild.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Batch align interviews 0001, 0004, 0006, and 0010 using syncope- and intrusion-aware CTC segmentation on CPU
- [x] #2 Slice standalone phrase WAVs at acoustic pauses and export 7-tier Praat TextGrids and manifests
- [x] #3 Rebuild corpus search bundles (phrases.json and sources.json) and pass all unit and frontend tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Run batch CTC forced alignment on 0001, 0004, 0006, 0010 with shared ASR model instance
2. Slice phrase WAVs at acoustic pauses and export 7-tier Praat TextGrids
3. Rebuild phrases.json and sources.json with local phrase records
4. Run full test suite (python unittest, vitest, vite build) and log timing metrics
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed batch CTC forced alignment across interviews 0001 (Toney Cornshucker), 0004 (Jerry & Mary Scott), 0006 (Edward Bunch & Mack Flynn), and 0010 (Mary McCoy).

Benchmark Metrics:
- Clock Time: 1540.12s (25.67 min)
- Total Speech: 277.37 min across 1,360 turns
- Phrases Created: 2,578 standalone phrase WAVs sliced at acoustic pauses
- Effective Throughput: 10.81x real-time on CPU
- Exported 7-tier Praat TextGrids and alignment manifests
- Rebuilt public/data/phrases.json (13,188 total corpus phrases; 4,971 locally aligned STV phrases across 10 interviews)
<!-- SECTION:FINAL_SUMMARY:END -->
