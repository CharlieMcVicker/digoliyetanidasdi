---
id: TASK-31
title: Publish v0.2.0 audio release and update deployment workflow
status: In Progress
assignee:
  - '@self'
created_date: '2026-11-03 00:23'
updated_date: '2026-11-03 00:27'
labels: []
dependencies: []
modified_files:
  - .github/workflows/deploy.yml
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Package the updated MP3 audio archives (including re-sliced Bible verse audio), publish GitHub release v0.2.0, update .github/workflows/deploy.yml to reference the new release, and verify GitHub Pages deployment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Package sentence_audio, split_audio, stv_audio, and stv_turn_audio into tar.gz archives
- [x] #2 Publish GitHub Release v0.2.0 with all four audio archives attached
- [x] #3 Update deploy.yml to download audio from v0.2.0 and verify workflow syntax
- [ ] #4 Push changes to main and verify GitHub Pages deployment succeeds
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create tar.gz archives for sentence_audio, split_audio, stv_audio, and stv_turn_audio in audio_mp3/
2. Upload release v0.2.0 to GitHub with gh release create
3. Update .github/workflows/deploy.yml to reference v0.2.0
4. Commit, push to main, and monitor/verify GitHub Actions deployment
<!-- SECTION:PLAN:END -->
