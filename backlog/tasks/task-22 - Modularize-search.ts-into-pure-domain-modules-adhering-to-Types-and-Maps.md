---
id: TASK-22
title: Modularize search.ts into pure domain modules adhering to Types and Maps
status: Done
assignee:
  - '@self'
created_date: '2026-10-31 20:43'
updated_date: '2026-10-31 20:48'
labels: []
dependencies: []
modified_files:
  - src/lib/phonetics.ts
  - src/lib/context.ts
  - src/lib/highlight.tsx
  - src/lib/search.ts
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Partition monolithic src/lib/search.ts (752 lines) into focused, single-responsibility modules: phonetics.ts for orthographic transduction, context.ts for turn identity and context windows, and search.ts for indexing and query scoring.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Extract normalizeTTHQuery, normalizeDGQueryToTTH, toBroadTTH, and phoneticNgramTokenizer to src/lib/phonetics.ts
- [x] #2 Extract resolvePhraseTurnIdentity, buildTurnPartCountsMap, and buildOrderedSourceContextWindow to src/lib/context.ts
- [x] #3 Retain search indexing, scoring, and sorting in src/lib/search.ts with re-exports for backwards compatibility
- [x] #4 Ensure search.test.ts and all downstream consumers pass without breakage
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create src/lib/phonetics.ts with normalizeTTHQuery, normalizeDGQueryToTTH, toBroadTTH, and phoneticNgramTokenizer.
2. Create src/lib/context.ts with resolvePhraseTurnIdentity, buildTurnPartCountsMap, and buildOrderedSourceContextWindow.
3. In src/lib/search.ts, import from phonetics.ts and context.ts, and re-export them so all existing import paths remain 100% backwards compatible.
4. Run vitest and typecheck to verify zero regressions.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Modularized src/lib/search.ts into focused domain modules adhering to the Types & Maps principle:
- `src/lib/phonetics.ts`: Pure functional query normalizers (`normalizeTTHQuery`, `normalizeDGQueryToTTH`, `toBroadTTH`) and `phoneticNgramTokenizer`.
- `src/lib/context.ts`: Pure context projections (`resolvePhraseTurnIdentity`, `buildTurnPartCountsMap`, `buildOrderedSourceContextWindow`).
- `src/lib/highlight.tsx`: Regex builders (`buildPhoneticHighlightRegex`, `buildEnglishHighlightRegex`) and token highlighter component.
- `src/lib/search.ts`: Retains MiniSearch index creation, match candidate evaluation, and confidence ranking, while re-exporting the pure domain modules for full backwards compatibility.

All TypeScript typechecks and all 15 Vitest tests continue to pass with zero regressions.
<!-- SECTION:FINAL_SUMMARY:END -->
