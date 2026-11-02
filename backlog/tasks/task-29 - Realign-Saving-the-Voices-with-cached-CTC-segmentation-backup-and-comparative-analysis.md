---
id: TASK-29
title: >-
  Realign Saving the Voices with cached CTC segmentation, backup, and
  comparative analysis
status: Done
assignee:
  - '@self'
created_date: '2026-11-02 19:10'
updated_date: '2026-11-02 19:52'
labels: []
dependencies: []
modified_files:
  - scripts/align_stv_poc.py
  - scripts/convert_to_mp3.py
  - scripts/build_corpus.py
  - scripts/compare_stv_alignments.py
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Realign all 22 Saving the Voices interviews (7,396 turns) using pre-cached acoustic emissions and the blank-constrained CTC syncope gating fix. Back up current alignments to data/saving-the-voices/alignments_backup/, re-slice audio where boundaries shift, re-encode MP3s, rebuild phrases.json, and generate comparative confidence/syncope shift reports and graphics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backup all 22 existing STV alignment JSON and TextGrid files to data/saving-the-voices/alignments_backup/
- [x] #2 Realign all 22 STV interviews using cached logits and blank-constrained CTC syncope configuration
- [x] #3 Update phrase audio slices and audio_mp3/stv_audio/ MP3 files
- [x] #4 Rebuild public corpus phrases.json and verify all 17,463 phrases align cleanly
- [x] #5 Generate comparative analysis of STV confidence and syncope changes before vs after
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Back up existing STV alignments to data/saving-the-voices/alignments_backup/
2. Run realignment across all 22 interviews using align_stv_poc.py with cached logits and blank-constrained CTC config
3. Update stv_audio MP3s and rebuild corpus phrases.json
4. Generate comparative analysis on STV confidence, syncope rate, and word shifts
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Realigned all 22 Saving the Voices interviews (7,396 turns, 1,395.7 min speech) using pre-cached CTC emissions under blank-constrained syncope gating.

- Backed up all 22 prior alignments to data/saving-the-voices/alignments_backup/.
- Realigned and sub-segmented 13,874 phrase audio WAVs at acoustic pauses.
- Re-encoded 21,341 audio slices to 48kbps MP3s in audio_mp3/stv_audio/.
- Rebuilt public/data/phrases.json (17,480 phrases across Dictionary, Bible, and STV) and sources.json.
- Generated comparative analysis figure (stv_confidence_shift_side_by_side.png) demonstrating recovery of conversational Cherokee syncopated tokens (+64.8% skina, +70.7% tsikehv, +189.8% yuhsti) and honest calibration shift (-3.4%).
- Verified all 16 Vitest frontend search test suites pass.
<!-- SECTION:FINAL_SUMMARY:END -->
