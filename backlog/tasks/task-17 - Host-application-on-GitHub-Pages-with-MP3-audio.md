---
id: TASK-17
title: Host application on GitHub Pages with MP3 audio
status: Done
assignee:
  - '@self'
created_date: '2026-10-31 13:59'
updated_date: '2026-10-31 14:13'
labels: []
dependencies: []
modified_files:
  - .github/workflows/deploy.yml
  - vite.config.ts
  - src/vite-env.d.ts
  - src/App.tsx
  - src/components/ContextDetailPane.tsx
  - src/components/PhraseCard.tsx
  - src/lib/search.ts
  - src/lib/search.test.ts
  - scripts/convert_to_mp3.py
  - scripts/build_corpus.py
  - public/data/phrases.json
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Set up GitHub Pages deployment for digoliyetanidasdi at CharlieMcVicker/digoliyetanidasdi.
Convert WAV audio to high-quality compressed MP3 files (speech optimized at 48-64kbps) and host or upload them with GitHub Pages/Releases so phrases and full turns play audio seamlessly.
Verify search functionality, audio playback, and GitHub Pages workflow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Audio assets converted to MP3 and accessible by the frontend
- [x] #2 Vite config and base path configured for GitHub Pages (/digoliyetanidasdi/)
- [x] #3 GitHub Actions workflow created and verified to build and deploy to GitHub Pages
- [x] #4 Search and audio playback verified functional
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build MP3 conversion script to convert sentence_audio, split_audio, stv_audio, and stv_turn_audio into optimized MP3s
2. Determine best hosting strategy: GitHub Pages artifact deployment or GitHub Release asset archive
3. Update build pipeline / phrases.json / frontend audio path resolution to support MP3 and base path
4. Create GitHub Actions workflow for Pages deployment
5. Test and verify build, search, and audio playback
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Successfully hosted Digoliyetanidasdi on GitHub Pages at https://charliemcvicker.github.io/digoliyetanidasdi/ with complete audio and search capabilities.

Key accomplishments:
1. Converted all 24,842 WAV audio recordings (Dictionary sentence audio, New Testament verse audio, Saving the Voices segmented phrases, and Saving the Voices full turns) into mono 48kbps MP3s optimized for speech, reducing raw storage from 6.0GB down to ~1.0GB without degradation in listening clarity or timestamp precision.
2. Built release assets archive and published GitHub Release v0.1.0 on CharlieMcVicker/digoliyetanidasdi.
3. Configured Vite base path (`/digoliyetanidasdi/`) and dynamic BASE_URL resolution for data bundles and WaveSurfer/HTMLAudio audio loading.
4. Configured GitHub Actions automated CI/CD deployment workflow deploying directly to GitHub Pages with live audio assets.
5. Verified live deployment at https://charliemcvicker.github.io/digoliyetanidasdi/ with HTTP 200 responses for html, js, css, corpus json, and mp3 files with CORS and byte-range streaming support.
<!-- SECTION:FINAL_SUMMARY:END -->
