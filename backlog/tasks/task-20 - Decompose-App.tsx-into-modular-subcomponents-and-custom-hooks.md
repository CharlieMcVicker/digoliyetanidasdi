---
id: TASK-20
title: Decompose App.tsx into modular subcomponents and custom hooks
status: Done
assignee:
  - '@self'
created_date: '2026-10-31 20:42'
updated_date: '2026-10-31 20:45'
labels: []
dependencies: []
modified_files:
  - src/App.tsx
  - src/hooks/useCorpusData.ts
  - src/hooks/useCorpusSearch.ts
  - src/components/Header.tsx
  - src/components/SearchBar.tsx
  - src/components/FilterBar.tsx
  - src/components/EmptyDashboard.tsx
  - src/components/SearchResultsView.tsx
  - src/components/TerminologyModal.tsx
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extract monolithic logic from App.tsx (1,038 lines) into dedicated subcomponents (Header, SearchBar, FilterBar, EmptyDashboard, SearchResultsView, TerminologyModal) and custom hooks (useCorpusData, useCorpusSearch), preserving all existing search, audio, and grouping behaviors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Extract useCorpusData hook for loading sources.json and phrases.json and computing corpus statistics
- [x] #2 Extract useCorpusSearch hook for running search, filtering, and sorting
- [x] #3 Extract Header, SearchBar, FilterBar, EmptyDashboard, SearchResultsView, and TerminologyModal into src/components/
- [x] #4 App.tsx is reduced to clean layout orchestration under 200 lines
- [x] #5 All existing tests pass and typecheck succeeds with zero errors
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create src/hooks/useCorpusData.ts to handle data fetching and index/map memoization.
2. Create src/hooks/useCorpusSearch.ts to handle search querying, filtering, and sorting.
3. Create src/components/Header.tsx with branding and corpus stats.
4. Create src/components/SearchBar.tsx with mode select and Enter/button trigger.
5. Create src/components/FilterBar.tsx with collection pills, source select, confidence toggle, sort select, and grouping checkbox.
6. Create src/components/EmptyDashboard.tsx with statistics, info banner, color legend, and example queries.
7. Create src/components/SearchResultsView.tsx with grouped accordions and flat list rendering.
8. Create src/components/TerminologyModal.tsx with educational and under-the-hood copy.
9. Refactor App.tsx to orchestrate these modular components and hooks.
10. Run typecheck and tests.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decomposed App.tsx from 1,038 lines to 183 lines by extracting two custom hooks and six dedicated subcomponents:
- `useCorpusData`: Async JSON loading, Map lookups, and corpus duration/confidence stats.
- `useCorpusSearch`: Search state, filtering, sorting, and MiniSearch result memoization.
- `Header`: Top navigation, branding, and corpus stat pills.
- `SearchBar`: Unified search input, mode selector dropdown, and update/search triggers.
- `FilterBar`: Collection pills, source select, confidence toggle, and sort/group controls.
- `EmptyDashboard`: Welcome hero, statistics, word timing notice, quality legend, and example queries.
- `SearchResultsView`: Grouped accordions and flat result lists.
- `TerminologyModal`: "How It Works" modal and under-the-hood technical copy.

All TypeScript typechecks and Vitest tests pass with zero errors.
<!-- SECTION:FINAL_SUMMARY:END -->
