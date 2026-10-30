---
id: TASK-8
title: >-
  Batch align Saving the Voices interviews (20-minute run: 0005, 0015, 0067,
  0002)
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 18:33'
updated_date: '2026-10-30 18:59'
labels: []
dependencies: []
modified_files:
  - scripts/align_stv_poc.py
  - scripts/build_corpus.py
  - public/data/phrases.json
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run the syncope- and intrusion-aware CTC forced alignment pipeline across the next 4 Saving the Voices interviews (~205 minutes of Cherokee speech, ~18-20 minutes compute), slicing phrase WAVs, generating Praat TextGrids and manifests, and integrating into phrases.json.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Batch alignment pipeline processes interviews 0005 (Martin Ballou), 0015 (Lillie Vann), 0067 (Lillie Vann & Carolyn Fourkiller), and 0002 (Charley & Mary McCoy)
- [x] #2 All 4 interviews have standalone phrase WAVs sliced at acoustic pauses and 7-tier Praat TextGrids exported
- [x] #3 Corpus bundles (sources.json and phrases.json) are updated with the newly aligned interviews and all unit/frontend tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update align_stv_poc.py with --batch mode and shared model instance
2. Run batch alignment on 0005, 0015, 0067, 0002 (~18-20m compute)
3. Rebuild corpus JSON bundles and verify WaveSurfer phrases
4. Run full test suite and log timing metrics
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Batch aligned 4 Saving the Voices interviews (0005 Martin Ballou, 0015 Lillie Vann, 0067 Lillie Vann & Carolyn Fourkiller, 0002 Charley & Mary McCoy) totaling 204.68 minutes of Cherokee audio.

Key Metrics:
- Clock Time: 1141.72s (19.03 min)
- Audio Volume: 204.68 min across 1,220 turns
- Phrases Created: 1,862 standalone phrase WAVs sliced at acoustic pauses (under 15s each)
- Effective Throughput: 10.76x real-time on CPU (ARM NEON)
- Exported 7-tier Praat TextGrids and alignment manifests for all 4 interviews
- Ingested into public/data/phrases.json and public/data/sources.json (now 2,393 locally aligned STV phrases)
- All 15 Python unit tests and 12 Vite frontend tests pass cleanly
<!-- SECTION:FINAL_SUMMARY:END -->
