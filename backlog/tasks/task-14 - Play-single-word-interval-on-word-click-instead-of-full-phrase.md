---
id: TASK-14
title: Play single word interval on word click instead of full phrase
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 20:22'
updated_date: '2026-10-30 20:25'
labels: []
dependencies: []
modified_files:
  - src/components/PhraseCard.tsx
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the user clicks an individual Cherokee word in PhraseCard, play only that word's audio interval (start to end) rather than continuing playback for the entire remainder of the phrase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a word plays strictly within that word's start and end timestamps in WaveSurfer
- [x] #2 Remote audio segments support bounded word playback when word start/end are specified
- [x] #3 Playing via the main Play/Pause button continues to play the full phrase
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Vitest unit tests and production build pass
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update PhraseCard.tsx ensureWaveSurferAndPlay to accept optional endSeconds.
2. Store pendingRangeRef ({ start, end }) for initial load and pass both start and end to wavesurfer.play(start, end).
3. Add bound check on remote audio element for seekToSeconds and endSeconds.
4. Update handleWordClick to pass w.start and w.end to ensureWaveSurferAndPlay.
5. Verify Vitest tests and production build.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated PhraseCard word click behavior to play only the clicked word interval:
- Updated `handleWordClick` to compute bounded interval `[w.start, endSec]` (with `endSec = Math.max(w.start + 0.05, w.end)`).
- Updated `ensureWaveSurferAndPlay` to accept `seekToSeconds` and `endSeconds`.
- Invoked `wavesurfer.play(start, end)` directly so WaveSurfer plays the bounded word slice and stops automatically at the end of the word.
- Added precise bounding check for remote audio streaming.
- Main phrase Play/Pause button remains unbounded to play the full phrase as expected.
- Verified with Vitest tests and production Vite build.
<!-- SECTION:FINAL_SUMMARY:END -->
