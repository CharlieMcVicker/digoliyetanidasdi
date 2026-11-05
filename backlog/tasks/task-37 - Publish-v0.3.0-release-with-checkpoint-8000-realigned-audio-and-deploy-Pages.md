---
id: TASK-37
title: Publish v0.3.0 release with checkpoint-8000 realigned audio and deploy Pages
status: Done
assignee:
  - '@self'
created_date: '2026-11-05 21:10'
updated_date: '2026-11-05 21:17'
labels: []
dependencies: []
modified_files:
  - .github/workflows/deploy.yml
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Package the re-aligned and expanded MP3 audio archives (checkpoint-8000 for NT Bible all 5 books and all 22 Saving the Voices interviews), publish GitHub Release v0.3.0, update .github/workflows/deploy.yml to reference v0.3.0, and verify GitHub Pages deployment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Package sentence_audio, split_audio, stv_audio, and stv_turn_audio into updated tar.gz archives
- [x] #2 Create GitHub Release v0.3.0 with release notes and attach all four audio archives
- [x] #3 Update deploy.yml to download audio from release v0.3.0
- [x] #4 Commit and push changes to main and verify GitHub Pages deployment
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Package sentence_audio, split_audio, stv_audio, and stv_turn_audio into audio_archives/*.tar.gz
2. Stage and commit uncommitted benchmark scripts, tasks, alignment manifest updates, and corpus data
3. Create and push tag v0.3.0 and publish GitHub Release v0.3.0 with tar.gz assets
4. Update .github/workflows/deploy.yml to target v0.3.0
5. Push to main and monitor the GitHub Pages deployment action
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Packaged updated MP3 audio archives (~1.08GB total across sentence_audio, split_audio, stv_audio, and stv_turn_audio), published GitHub Release v0.3.0 at https://github.com/CharlieMcVicker/digoliyetanidasdi/releases/tag/v0.3.0, updated .github/workflows/deploy.yml to download v0.3.0 assets, pushed commits to main, and verified that GitHub Pages deployment succeeded with all site and audio endpoints returning HTTP 200.
<!-- SECTION:FINAL_SUMMARY:END -->
