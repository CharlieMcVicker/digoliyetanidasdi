---
id: TASK-3
title: >-
  Phase 1 Frontend: Three-box search engine, WaveSurfer playback, and confidence
  UX
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 15:59'
updated_date: '2026-10-30 16:17'
labels: []
dependencies:
  - TASK-2
modified_files:
  - package.json
  - tsconfig.json
  - vite.config.ts
  - index.html
  - src/types/corpus.ts
  - src/lib/search.ts
  - src/lib/search.test.ts
  - src/components/PhraseCard.tsx
  - src/App.tsx
  - src/main.tsx
  - src/index.css
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the React 18 + TypeScript + Vite + Tailwind CSS + WaveSurfer.js v7 + MiniSearch client-side web application with three exclusive search inputs (D/G, T/TH, English), 3-gram phonetic indexing with substring post-filtering, confidence-based sorting and color-coding, and synchronized 1:1 word-level karaoke highlighting and click-to-seek.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Three exclusive search inputs (D/G, T/TH, English) normalize queries appropriately and execute waterfall Strict/Broad/English searches with multi-word non-sequential substring post-filtering
- [x] #2 Matched query words and phrase badges are color-coded by alignment confidence (>=0.8 green, 0.1-0.8 amber, <0.1 red) while non-matching words remain neutral until hovered or played
- [x] #3 Search results sort by matched word confidence (with phrase mean_confidence tie-breaker and user sort toggle)
- [x] #4 Clicking Play or any word span loads WaveSurfer.js waveform, seeks to word start time, and highlights active words 1:1 in both phonetics and syllabary simultaneously
- [x] #5 Empty state displays corpus statistics and clickable example queries across D/G, T/TH, and English
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Unit tests cover normalization, 3-gram tokenization, multi-word post-filtering, and confidence sorting; frontend type-checks and builds cleanly
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Scaffold React 18 + TypeScript + Vite + Tailwind CSS + WaveSurfer.js v7 + MiniSearch + Vitest project
2. Implement src/types/corpus.ts and src/lib/search.ts (D/G & TTH normalizers, 3-gram tokenizer, multi-word non-sequential substring post-filtering, confidence sorting & regex highlighter) with unit tests
3. Build WaveSurfer player component with synchronized 1:1 word highlighting and click-to-seek
4. Build 3-box search header, confidence color-coded phrase cards, sort/filter controls, and empty-state dashboard
5. Run unit tests, type-check, and production build
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the React 18 + TypeScript + Vite + Tailwind CSS + WaveSurfer.js v7 + MiniSearch frontend:
- Three exclusive search inputs (D/G, T/TH, English) with full digohwelisgi D/G->T/TH consonant respelling and direct T/TH normalization
- 3-gram-only phonetic indexing with non-sequential multi-word substring post-filtering
- Confidence sorting (Matched Word Confidence Desc, Phrase Mean Confidence Desc, Canonical Order) and "Hide Flagged" anomaly filter
- Confidence color-coding on matched query words and phrase badges (>=0.80 green, 0.10-0.79 amber, <0.10 red), while non-matching words remain neutral until hovered or played
- Synchronized 1:1 word-level karaoke highlighting across syllabary and phonetics with click-to-seek on any word
- Verified with 8 Vitest unit tests, tsc --noEmit, and vite build
<!-- SECTION:FINAL_SUMMARY:END -->
