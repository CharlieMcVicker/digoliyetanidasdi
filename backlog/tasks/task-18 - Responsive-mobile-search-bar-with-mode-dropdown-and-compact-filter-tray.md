---
id: TASK-18
title: Responsive mobile search bar with mode dropdown and compact filter tray
status: Done
assignee:
  - '@self'
created_date: '2026-10-31 17:49'
updated_date: '2026-10-31 17:55'
labels: []
dependencies: []
modified_files:
  - src/App.tsx
  - src/components/PhraseCard.tsx
  - src/components/ContextDetailPane.tsx
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Consolidate the three search boxes into a unified search bar with a mode dropdown selector (Standard d/t, Linguistic t/th, English meaning). Compact the sticky top header for small screens with collapsible filter controls to maximize visible scroll area for audio results.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Three search inputs are replaced with a single search bar and an integrated mode dropdown selector supporting d/t, t/th, and English
- [x] #2 Sticky top header is compact on mobile with collapsible/expandable filter and sort controls, leaving ample visible viewport for scrolling search results
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Refactor search state in App.tsx to use unified query string and search mode dropdown selector.
2. Streamline sticky header layout: compact logo/title on small screens, integrated search bar with mode selector and enter/search action.
3. Implement responsive/collapsible filter and sort tray with active filter indicator count so full filters are accessible on tap without consuming mobile screen space.
4. Tune mobile padding and card audio controls for small screen viewports.
5. Run test suite and build verification.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the three search input boxes with a single unified search bar featuring an integrated search mode dropdown (Standard d/t, Linguistic t/th, English meaning). Compacted the sticky top bar on mobile from ~525px down to ~115px (a 78% reduction) with collapsible filter and sort controls, responsive collection pills, and tuned card/context padding to leave extensive visible viewport for scrolling and playing audio results.
<!-- SECTION:FINAL_SUMMARY:END -->
