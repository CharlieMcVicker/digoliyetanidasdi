---
id: TASK-24
title: >-
  Whole-turn English search results and synchronized turn audio word
  highlighting
status: Done
assignee:
  - '@self'
created_date: '2026-11-02 14:40'
updated_date: '2026-11-02 14:51'
labels: []
dependencies: []
modified_files:
  - src/types/corpus.ts
  - src/lib/context.ts
  - src/lib/search.ts
  - src/lib/search.test.ts
  - src/hooks/useCorpusData.ts
  - src/hooks/useCorpusSearch.ts
  - src/components/TurnCard.tsx
  - src/components/SearchResultsView.tsx
  - src/components/ContextDetailPane.tsx
  - src/App.tsx
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In English search mode, return and display whole conversational turns instead of isolated aligned subchunks so translations correspond accurately to the Cherokee speech without duplicate cards. Also support live word-by-word karaoke highlighting across all subchunks during full-turn audio playback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 English search indexes and returns whole conversational turns across Saving the Voices, Bible verses, and Dictionary entries without duplicate subchunk results
- [x] #2 Search results in English mode render Turn cards with prominent highlighted English translation, full-turn audio playback, and accessible subchunk breakdown
- [x] #3 Playing full-turn audio highlights currently spoken words in real time across subchunk segments using exact timing offsets
- [x] #4 Clicking a Cherokee word in a turn seeks the full-turn audio to that word\'s timestamp
- [x] #5 ContextDetailPane and SearchResultsView reuse coherent turn and audio playback logic
- [x] #6 Unit tests pass covering turn indexing, English search turn grouping, and live word offset calculation
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All unit tests pass and production build succeeds
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Model domain Types and pure Maps (TurnRecord, ScoredTurnMatch, word-in-turn timing)
2. Implement pure turn extraction, TurnIndex in MiniSearch, and English turn search in search.ts
3. Implement synchronized turn audio playback with live word highlighting across subchunks and word seeking
4. Build reusable TurnCard component and integrate into SearchResultsView and ContextDetailPane
5. Add comprehensive unit tests in search.test.ts and verify build
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented whole-turn English search results and synchronized turn audio word highlighting:

1. Domain Modeling (Types & Maps):
- Added `TurnRecord`, `ScoredTurnMatch`, and `WordTurnTiming` to `src/types/corpus.ts`.
- Added pure transformations `buildCorpusTurns`, `computeWordTurnTime`, and `computeTurnWordTimings` in `src/lib/context.ts`.

2. Whole-Turn English Indexing & Search:
- Updated `createCorpusIndexes` and `searchCorpus` in `src/lib/search.ts` to index turns directly in `englishIndex`.
- Eliminates duplicate cards when searching English across Saving the Voices multi-part turns.
- Added `compareScoredTurnMatches` and `flattenAndSortTurnMatches` supporting all sort options.

3. TurnCard Component & Real-Time Karaoke Highlighting:
- Created shared `TurnCard.tsx` with full-turn audio player, time scrubber, duration, and 0.8x/0.9x/1.0x playback speed selector.
- Synchronized live word highlighting across all subchunks using exact `phraseOffset + word.start/end` offsets.
- Two-way interaction: clicking any Cherokee word in the turn seeks the audio player directly to that word.
- Prominently displays English translation with search query highlighting.

4. View Reusability & Context Drawer Integration:
- Replaced manual turn rendering in `ContextDetailPane.tsx` with `TurnCard` in context-drawer mode.
- Integrated `TurnCard` into `SearchResultsView.tsx` when `committedMode === "english"`.

5. Verification:
- Added comprehensive unit tests in `src/lib/search.test.ts` covering turn grouping, timing offsets, and English search results.
- All 16 unit tests passing and production build (`npm run build`) succeeded.
<!-- SECTION:FINAL_SUMMARY:END -->
