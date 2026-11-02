---
id: TASK-25
title: Fix bounded single word playback on word click in TurnCard
status: Done
assignee:
  - '@self'
created_date: '2026-11-02 15:31'
updated_date: '2026-11-02 15:34'
labels: []
dependencies: []
modified_files:
  - src/components/TurnCard.tsx
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an individual Cherokee word is clicked in TurnCard, play strictly within that word's start and end timestamps rather than continuing playback to the end of the entire turn recording.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a Cherokee word in TurnCard plays only that single word\'s interval (start to end) and stops automatically
- [x] #2 Bounded playback handles both local turn MP3s and remote audio segments with stopAtSeconds bounding
- [x] #3 Playing via the main Play/Pause button or time scrubber continues to play the full turn unbounded
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Unit tests pass and production build succeeds
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add stopAtSecondsRef and stopSec parameter to playTurnAtOffset in TurnCard.tsx
2. Stop playback and reset active word in monitoring loop when currentTime reaches stopAtSeconds
3. Pass bounded word interval in handleWordClick
4. Verify tests and production build
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed bounded word playback in TurnCard:
- Added `stopAtSecondsRef` and `stopSec` parameter to `playTurnAtOffset`.
- In `handleWordClick`, computed the bounded word interval `[startSec, Math.max(startSec + 0.05, endSec)]` via `computeWordTurnTime` and passed it to `playTurnAtOffset`.
- In both the `requestAnimationFrame` loop and `timeupdate` handler, automatically pauses audio, clears active word highlight, and resets the stop target when audio position reaches the end of the clicked word.
- Ensured `togglePlayPause` and `handleScrubberChange` clear `stopAtSecondsRef` so normal play and scrubber seeking remain unbounded.
- Verified with unit tests and production Vite build.
<!-- SECTION:FINAL_SUMMARY:END -->
