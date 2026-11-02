---
id: TASK-30
title: Fix bounded part playback on Play part click in TurnCard
status: Done
assignee:
  - '@self'
created_date: '2026-11-02 20:54'
updated_date: '2026-11-02 20:56'
labels: []
dependencies: []
modified_files:
  - src/components/TurnCard.tsx
  - src/lib/context.ts
  - src/lib/search.test.ts
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In TurnCard, clicking "Play part" seeks to the phrase start offset but omits stopSec, causing audio playback to continue through the rest of the entire turn rather than stopping at the end of the selected part. Provide a pure helper computePhraseTurnTime to calculate the turn-relative [startSec, endSec] interval and pass endSec to playTurnAtOffset.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 computePhraseTurnTime calculates the correct turn-relative start and end time (with minimum duration buffer) for a phrase within a turn
- [x] #2 TurnCard passes phrase end timing to playTurnAtOffset so clicking Play part stops at the end of the phrase instead of playing the rest of the turn
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define and export pure function computePhraseTurnTime in src/lib/context.ts and export from src/lib/search.ts
2. Update TurnCard.tsx to compute phrase bounds using computePhraseTurnTime and pass pEnd to playTurnAtOffset(pStart, pEnd) when clicking "Play part"
3. Add unit tests for computePhraseTurnTime in src/lib/search.test.ts and verify all tests pass
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fix "Play part" playback in TurnCard by computing turn-relative start and end boundaries with computePhraseTurnTime and passing endSec to playTurnAtOffset, bounding audio playback to the clicked phrase.

Verification:
- Unit tests added to src/lib/search.test.ts for multi-part STV subchunks, standalone phrases, and minimum duration bounds
- All vitest unit tests passing (16/16)
- TypeScript type-check and vite build passing
<!-- SECTION:FINAL_SUMMARY:END -->
