---
id: TASK-26
title: Realign Bible with syncope fix and update confidence/syncope stats
status: Done
assignee:
  - '@self'
created_date: '2026-11-02 17:12'
updated_date: '2026-11-02 17:20'
labels: []
dependencies: []
modified_files:
  - public/data/sources.json
  - public/data/phrases.json
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Realign all 44 chapters of the Cherokee New Testament (Mark and Matthew) using the merged ctc-segmentation syncope gating fix to prevent false nahski -> nhski collapse, rebuild corpus data, and generate updated length vs confidence and syncope vs confidence analysis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All 44 chapters of Mark and Matthew realigned and saved to bible_alignment_records.json
- [x] #2 Corpus rebuilt in digoliyetanidasdi
- [x] #3 Length vs confidence and syncope vs confidence metrics updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Monitor task-565 until Mark and Matthew are fully realigned and saved
2. Run scripts/build_corpus.py to rebuild public corpus datasets
3. Calculate updated length vs confidence and syncope vs confidence statistics
4. Generate scatter plots and update analysis artifacts
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Realigned all 44 chapters of the Cherokee New Testament (Mark 1-16 and Matthew 1-28) using the merged ctc-segmentation PR #11/#12 syncope fix. Rebuilt public corpus datasets and updated length vs confidence and syncope vs confidence analysis.
<!-- SECTION:FINAL_SUMMARY:END -->
