---
id: TASK-7
title: >-
  Explicit search-on-Enter/button workflow, <5% confidence filtering, and
  source/collection filtering
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 16:59'
updated_date: '2026-10-30 17:05'
labels: []
dependencies: []
modified_files:
  - src/types/corpus.ts
  - src/lib/search.ts
  - src/lib/search.test.ts
  - src/App.tsx
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve search responsiveness and result filtering:
1. Replace auto-debounced live search with an explicit search workflow (Enter key or Search / "Update Search" button) so typing 2-3 character queries never freezes the UI.
2. By default, hide phrases with <5% mean confidence (`mean_confidence < 0.05`) and exclude word matches where the matched word has <5% confidence (`confidence < 0.05`), with a top-level toggle to reveal `<5%` confidence matches when wanted.
3. Add source filtering via top-level corpus collection filter pills (All, Dictionary, New Testament, Saving the Voices) plus a specific Source/Chapter/Speaker dropdown.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Typing in any of the 3 search inputs does not trigger an immediate search; pressing Enter or clicking the Search / Update Search button (or clicking an example query chip) executes the search.
- [x] #2 By default, phrases with mean_confidence < 0.05 and phonetic word matches only occurring on words with confidence < 0.05 are excluded from search results, and a toggle at the top allows revealing <5% confidence phrases/words.
- [x] #3 Users can filter search results by top-level corpus collection (Dictionary, New Testament, Saving the Voices) and by specific source/chapter/interview.
- [x] #4 Unit tests in src/lib/search.test.ts and production build pass.
- [x] #5 Users can sort search results by shortest sentence (word count / phonetic length ascending).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define SearchFilterOptions in src/types/corpus.ts (minConfidenceThreshold, hideAnomalies, sourceType, sourceId).
2. Update evaluatePhoneticSubstringMatch and searchCorpus in src/lib/search.ts to enforce minimum confidence threshold (<5% hidden by default for both phrase mean_confidence and matched word confidence) and source/collection filtering.
3. Update src/App.tsx to use explicit search submission (Enter key or Search / Update Search button), top-level toggle to reveal <5% confidence phrases/words, and collection pills + source dropdown filter.
4. Add unit tests in src/lib/search.test.ts for <5% confidence filtering and source filtering, then run tests and build.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented explicit search-on-Enter/button workflow, <5% confidence filtering, and source/collection filtering:
1. Replaced auto-debounced live search with an explicit search workflow (`committedQuery` / `committedMode`) triggered on Enter, clicking the "Search" / "Update Search" button, or clicking an example query chip.
2. Excluded phrases with `mean_confidence < 0.05` and phonetic word matches with `word.confidence < 0.05` by default (`minConfidence: 0.05`), and added a top-bar toggle (`<5% Confidence Hidden (Reveal)`) to reveal them when wanted.
3. Added corpus collection filter pills (All Collections, 1975 Dictionary, New Testament, Saving the Voices) alongside a specific Source/Chapter/Interview dropdown.
4. Added unit tests in `src/lib/search.test.ts` covering `<5%` confidence filtering and source filtering; verified all 11 tests and `npm run build` pass.
<!-- SECTION:FINAL_SUMMARY:END -->
