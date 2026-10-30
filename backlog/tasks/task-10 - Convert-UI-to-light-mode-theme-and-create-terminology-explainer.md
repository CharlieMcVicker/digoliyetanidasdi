---
id: TASK-10
title: Convert UI to light-mode theme and create terminology explainer
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 19:29'
updated_date: '2026-10-30 19:34'
labels: []
dependencies: []
modified_files:
  - src/App.tsx
  - src/components/PhraseCard.tsx
  - docs/TERMINOLOGY.md
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
1. Convert the application frontend from dark mode to a clean, accessible, simple light-mode theme with high-contrast Cherokee syllabary typography and clear waveform contrast.
2. Identify technical specifics and jargon across the app (CTC forced alignment, syncope/vowel dropping, intrusion-aware trellis, D/G vs T/TH orthography, confidence scores/flags, soft-masking VAD) and create a public-facing markdown guide explaining these terms in plain, community-friendly language.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Frontend uses a clean, accessible light-mode theme by default with no harsh dark-mode backgrounds
- [x] #2 WaveSurfer waveforms, playback progress, and word timing pills look sharp and readable in light mode
- [x] #3 Create a comprehensive public-facing terminology explainer document in docs/TERMINOLOGY.md defining technical concepts in accessible language
- [x] #4 All vitest tests and vite production build pass cleanly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect frontend CSS/Tailwind classes and WaveSurfer config across App.tsx, index.css, and components
2. Refactor to a clean, elegant light mode (neutral-50 background, white cards, high-contrast slate text, warm amber/emerald accents, refined waveforms)
3. Write public-facing guide in docs/TERMINOLOGY.md explaining Cherokee phonetics, alignment, syncope, and confidence scores
4. Verify UI with vitest and vite build
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Converted the entire UI from dark mode to a clean, elegant, high-contrast light-mode theme and created a public-facing terminology guide in docs/TERMINOLOGY.md.

Key Deliverables:
1. Light-Mode Theme:
   - Neutral/slate-50 background, white cards with subtle slate-200 borders and shadow-2xs elevation.
   - High-contrast Cherokee syllabary typography (slate-950 font-medium) and clean romanization (slate-700).
   - Refined confidence pills (emerald-50, amber-50, rose-50) and active speaking word pills (sky-600 white text).
   - WaveSurfer waveforms rendered in slate-400 with sky-600 progress and slate-900 playhead.
2. Terminology & Public Facing Guide:
   - Created docs/TERMINOLOGY.md explaining Cherokee Syllabary, D/G vs T/TH orthographies, CTC forced alignment, Pre-Bible acoustic models, syncope/vowel dropping, h/glottal intrusions, VAD soft-masking, and confidence score thresholds in plain, welcoming language.
   - Added an in-app "Terminology Guide" modal accessible from the sticky header.
3. Verification:
   - 12 Vitest unit tests pass cleanly.
   - Vite production build passes with zero errors.
<!-- SECTION:FINAL_SUMMARY:END -->
