---
id: TASK-6
title: Segment Saving the Voices audio locally and run CTC forced alignment
status: To Do
assignee: []
created_date: '2026-10-30 16:43'
labels: []
dependencies: []
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Download and slice the Saving the Voices interview audio into per-segment local .wav clips and run syncope- and code-switching-aware CTC forced alignment across all segments to populate word-level timestamps and alignment confidence scores.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Interview audio is downloaded and sliced into standalone segment .wav files
- [ ] #2 CTC forced alignment computes word-level start/end timestamps and confidence scores for all Saving the Voices phrases
- [ ] #3 PhraseCard renders full WaveSurfer waveforms and word-level karaoke highlighting for Saving the Voices segments
<!-- AC:END -->
