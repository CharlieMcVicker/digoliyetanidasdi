---
id: TASK-19
title: >-
  Fix mobile and touch audio playback, local MP3 symlinks, and port 5174
  configuration
status: Done
assignee:
  - '@self'
created_date: '2026-10-31 18:00'
updated_date: '2026-10-31 18:02'
labels: []
dependencies: []
modified_files:
  - public/sentence_audio
  - public/split_audio
  - public/stv_audio
  - public/stv_turn_audio
  - src/components/PhraseCard.tsx
  - src/components/ContextDetailPane.tsx
  - vite.config.ts
  - package.json
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Resolve audio playback failure on mobile/touch emulation: link public/ audio paths to audio_mp3/ so MP3s are served with audio/mpeg headers, ensure audio playback initiates and unlocks reliably on touch devices, and configure Vite to use port 5174.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Audio files in public/ correctly resolve to audio_mp3 directories and return valid audio/mpeg responses on port 5174
- [x] #2 Clicking play buttons and clicking words reliably plays audio on mobile and touch emulation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update public/ audio symlinks (sentence_audio, split_audio, stv_audio, stv_turn_audio) to point directly to audio_mp3/.
2. Update package.json and vite.config.ts to set dev port to 5174 and allow audio directories.
3. Add error logging and mobile user-gesture unlock / touch event handling to PhraseCard and ContextDetailPane audio playback.
4. Verify MP3 responses and playback in browser on port 5174.
5. Run tests, build verification, and commit.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed audio playback on mobile and touch emulation: updated public/ audio symlinks to point to audio_mp3/ so all MP3 requests return HTTP 200 audio/mpeg instead of HTML 404 fallbacks; added touch-manipulation and select-none attributes to word tokens for instant touch response without 300ms tap delays; wrapped WaveSurfer playback in safePlay with error listeners; and configured Vite and package.json to run on port 5174.
<!-- SECTION:FINAL_SUMMARY:END -->
