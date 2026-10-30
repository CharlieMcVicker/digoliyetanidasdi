---
id: TASK-13
title: >-
  Add Group-by-Source toggle, flat search results, and Context Detail pane for
  Bible and re-segmented Interview turns
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 20:11'
updated_date: '2026-10-30 20:28'
labels: []
dependencies: []
modified_files:
  - scripts/build_corpus.py
  - src/types/corpus.ts
  - src/lib/search.ts
  - src/lib/search.test.ts
  - src/components/PhraseCard.tsx
  - src/components/ContextDetailPane.tsx
  - src/App.tsx
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable users to toggle "Group by source" (on by default, automatically unchecked when sorting by Shortest Phrase and re-checked when leaving Shortest Phrase unless manually overridden), display concise source badges on ungrouped cards, show multi-part turn badges on re-segmented interview chunks, and view Bible chapters and Saving the Voices interview turns in context (split pane on desktop >=1024px, full detail view with Back button on smaller screens).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Group by source checkbox is checked by default, auto-unchecks when selecting Shortest Phrase sort, and auto-rechecks when switching back unless manually overridden
- [x] #2 Ungrouped search results render as a flat list sorted globally with a concise non-redundant source badge on each card
- [x] #3 Re-segmented interview sub-chunks display the full turn translation and a Part X of Y badge on search result cards
- [x] #4 Ordered sources (New Testament chapters and Saving the Voices interviews) provide a View in Context action that opens a right-hand detail pane on desktop (lg+) or a full detail view with Back button on smaller screens
- [x] #5 Interview Context Detail groups sub-chunks of each turn under a single Turn Container with a shared Full Turn Translation banner, Play Full Turn audio control, highlighted target sub-chunk, and surrounding turns with expand controls
- [x] #6 Bible Context Detail displays +/- 3 surrounding verses with expand controls, highlights the target verse, and supports word-level audio playback
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Unit tests and frontend build pass without errors
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Enrich STV corpus build and symlink turn_audio so turn metadata (turn_id, phrase_index, turn_phrase_count, turn_audio_path, speaker_label) is available on PhraseRecord and compute client-side fallbacks.
2. Add pure domain types and maps in src/types/corpus.ts and src/lib/search.ts for flat sorting (flattenAndSortMatches), concise source badge formatting, and ordered source context slices (Bible chapter window and STV Turn Container window).
3. Update PhraseCard.tsx to support ungrouped source badges, multi-part turn badges (Part X of Y), View in Context triggers, and compact sub-chunk mode inside Turn Containers.
4. Create ContextDetailPane.tsx to render Bible chapter context (+/- 3 verses with expansion) and STV Interview Turn Containers (shared Full Turn Translation, Play Full Turn audio, highlighted target sub-chunk, +/- 1-2 surrounding turns with expansion).
5. Update App.tsx with Group by source checkbox (smart auto-toggle with Shortest Phrase), flat vs grouped results rendering, and responsive split-pane (lg+) / full-page (<lg) detail view.
6. Add unit tests in src/lib/search.test.ts and verify build and tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User reported that opening Chapter Context scrolled the page to the top because the right column lived in a normal document-flow grid and used element.scrollIntoView(). Converting ContextDetailPane into a fixed slide-out right drawer/panel (`fixed inset-y-0 right-0`) and scrolling only the internal container (`scrollContainerRef.current.scrollTop`) so the main window scroll position never jumps.

Removed right-padding reflow on <main> so search results stay full-width without text reflow/scroll shifts, and added a clickable grayed-out backdrop overlay (`fixed inset-0 bg-slate-900/35`) behind the slide-out ContextDetailPane.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Group-by-Source toggle, flat search results, multi-part turn indicators, and responsive Context Detail view:
- Added "Group by source" checkbox (checked by default, auto-unchecked when switching to "Shortest Phrase" sort, and auto-rechecked when leaving "Shortest Phrase" unless manually overridden).
- Added `flattenAndSortMatches` and `formatUngroupedSourceLocation` to render ungrouped search results as a globally sorted flat list with concise, non-redundant source badges on each card.
- Enriched Saving the Voices corpus records and added `buildTurnPartCountsMap` to display "Part X of Y" badges alongside the full turn translation on re-segmented interview sub-chunks.
- Created `ContextDetailPane` and `buildOrderedSourceContextWindow` for ordered sources (New Testament chapters and Saving the Voices interviews), rendering as a right-hand split pane on desktop (lg+) and a full detail page with "Back to results" button on smaller screens.
- Grouped re-segmented interview turns into a single Turn Container showing the shared "Full Turn Translation" banner once, a "Play Full Turn" continuous audio player, all sub-chunks in sequence with the selected phrase highlighted, and surrounding turns with expand controls.
- Verified with 15 Vitest unit tests, 15 Python unit tests, and full production Vite build.
<!-- SECTION:FINAL_SUMMARY:END -->
