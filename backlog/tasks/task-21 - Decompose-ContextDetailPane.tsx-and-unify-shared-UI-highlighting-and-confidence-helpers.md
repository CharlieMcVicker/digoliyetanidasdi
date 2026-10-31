---
id: TASK-21
title: >-
  Decompose ContextDetailPane.tsx and unify shared UI highlighting and
  confidence helpers
status: Done
assignee:
  - '@self'
created_date: '2026-10-31 20:43'
updated_date: '2026-10-31 20:47'
labels: []
dependencies: []
modified_files:
  - src/lib/highlight.tsx
  - src/lib/confidence.ts
  - src/lib/format.ts
  - src/components/context/FullTurnAudioButton.tsx
  - src/components/context/ContextPhraseRow.tsx
  - src/components/ContextDetailPane.tsx
  - src/components/PhraseCard.tsx
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extract FullTurnAudioButton and ContextPhraseRow out of ContextDetailPane.tsx into separate modular files. Deduplicate renderHighlightedToken and confidence color mappings into shared helper modules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create src/lib/highlight.ts and src/lib/confidence.ts to unify highlight token rendering and confidence flair styles
- [x] #2 Move FullTurnAudioButton and ContextPhraseRow to dedicated component files
- [x] #3 Update PhraseCard and ContextDetailPane to import the shared helpers without code duplication
- [x] #4 Vitest suite and TypeScript typecheck pass with zero errors
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create src/lib/highlight.ts with renderHighlightedToken.
2. Create src/lib/confidence.ts with unified confidence style definitions (getConfidenceColorClasses, getRowConfidenceFlair, getWordHighlightClasses).
3. Extract FullTurnAudioButton.tsx into src/components/context/FullTurnAudioButton.tsx.
4. Extract ContextPhraseRow.tsx into src/components/context/ContextPhraseRow.tsx.
5. Refactor ContextDetailPane.tsx and PhraseCard.tsx to consume the unified helpers and subcomponents.
6. Run typecheck and tests.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decomposed ContextDetailPane.tsx from 856 lines to 264 lines and eliminated cross-component duplication:
- Extracted `src/lib/highlight.tsx` (`renderHighlightedToken`) and `src/lib/confidence.ts` (`getConfidenceColorClasses`, `getWordHighlightClasses`, `getRowConfidenceFlair`).
- Extracted `src/lib/format.ts` (`formatTimeRange`).
- Extracted `FullTurnAudioButton` and `ContextPhraseRow` into `src/components/context/`.
- Refactored `PhraseCard.tsx` and `ContextDetailPane.tsx` to consume the unified modules without duplicate code.

All TypeScript typechecks and Vitest tests pass with zero errors.
<!-- SECTION:FINAL_SUMMARY:END -->
