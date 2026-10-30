---
id: TASK-15
title: >-
  Streamline ContextDetailPane with compact HR-separated rows, header play
  button, and bottom English translation
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 20:32'
updated_date: '2026-10-30 20:42'
labels: []
dependencies: []
modified_files:
  - src/components/ContextDetailPane.tsx
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace bulky nested PhraseCards and waveforms inside ContextDetailPane with clean, border-collapsed rows separated by horizontal rules (<hr>), slightly smaller Cherokee typography, a compact Play button in the row/turn header bar, word-click single-word audio playback, and English translation placed at the bottom.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ContextDetailPane removes waveforms and full card borders in favor of HR-separated compact rows
- [x] #2 Each phrase/turn in ContextDetailPane has a Play button in its top bar and supports clicking individual Cherokee words to play that word
- [x] #3 Cherokee syllabary and phonetic lines use slightly smaller, cleaner typography with English translation placed at the bottom
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Vitest unit tests and production build pass
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create a lightweight ContextPhraseRow component inside ContextDetailPane.tsx with no waveform and no heavy card borders.
2. Put a compact Play/Pause button in the top bar of each phrase row (and Turn header), and support clicking any Cherokee word to play just that word [w.start, w.end].
3. Render Cherokee syllabary and phonetic lines with slightly smaller font sizes, separated by clean <hr> dividers, and place the English translation at the bottom of the verse or turn.
4. Verify tests and production build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Adding a compact confidence quality flair badge (dot + label/percentage tooltip) to the top bar of each ContextPhraseRow in ContextDetailPane.tsx.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Streamlined ContextDetailPane with lightweight ContextPhraseRow:
- Removed nested PhraseCard boxes and WaveSurfer waveforms inside the context drawer.
- Replaced card borders with clean horizontal rules (`divide-y`) between verses/turns.
- Added a compact Play/Pause button in the top bar of each phrase row (plus Play Turn in multi-part interview turn headers) while preserving word-click single-word audio playback.
- Used slightly smaller Cherokee syllabary (`text-base sm:text-lg`) and phonetic (`text-xs sm:text-sm`) typography and placed English translations cleanly at the bottom.
- Verified with Vitest tests and Vite production build.
<!-- SECTION:FINAL_SUMMARY:END -->
