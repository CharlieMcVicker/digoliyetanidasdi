---
id: TASK-6
title: Segment Saving the Voices audio locally and run CTC forced alignment
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 16:43'
updated_date: '2026-10-30 17:42'
labels: []
dependencies: []
modified_files:
  - .gitignore
  - scripts/build_corpus.py
  - scripts/align_stv_poc.py
  - scripts/test_align_stv_poc.py
  - public/data/phrases.json
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Download and slice the Saving the Voices interview audio into per-segment local .wav clips and run syncope- and code-switching-aware CTC forced alignment across all segments to populate word-level timestamps and alignment confidence scores.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Interview audio is downloaded and sliced into standalone segment .wav files
- [x] #2 CTC forced alignment computes word-level start/end timestamps and confidence scores for all Saving the Voices phrases
- [x] #3 PhraseCard renders full WaveSurfer waveforms and word-level karaoke highlighting for Saving the Voices segments
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Download MP3 and pre-slice turn WAVs (0003: DJ Vann)
2. Implement pure text cleaning with laughter filtering and clause splitting
3. Run Silero VAD + syncope/intrusion CTC alignment on turn WAVs
4. Sub-segment long turns at pauses into ~5-15s phrase WAVs
5. Update build_corpus.py to integrate aligned phrases
6. Verify unit tests, production build, and UI playback
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Saving the Voices PoC CTC forced alignment and phrase slicing pipeline:
- Built scripts/align_stv_poc.py: downloads Kiwa Digital MP3, pre-slices turn WAVs, filters laughter stage directions (dropping ᎤᏰᏣᏍᎦ/ᎤᏂᏰᏣᏍᎦ when English has [laughter]), strips inline syllabary diacritics, splits clauses on ?, !, ..., and aligns with Silero VAD soft-masking and the intrusion-aware CTC trellis.
- Partitions long turns at acoustic pauses into ~5-15s phrase WAVs with 0-indexed word timestamps, acoustic vowel-drop and h/' intrusion phonetics (emitted_word), and confidence scores.
- Aligned 2 complete interviews ahead of schedule (before 1pm):
  1. DJ Vann (stv_0003_dj_vann): 100 turns, 287 phrase WAVs, 40.96 min speech, 11.47x real-time speed.
  2. Naomi Stone (stv_0011_naomi_stone): 179 turns, 244 phrase WAVs, 33.27 min speech, 11.33x real-time speed.
- Exported 7-tier Praat TextGrids and JSON manifests to data/saving-the-voices/alignments/.
- Updated scripts/build_corpus.py to symlink public/stv_audio and ingest locally aligned phrase WAVs into phrases.json, enabling full WaveSurfer waveform and karaoke highlighting.
- Added comprehensive unit tests in scripts/test_align_stv_poc.py; all tests and production build pass.
<!-- SECTION:FINAL_SUMMARY:END -->
