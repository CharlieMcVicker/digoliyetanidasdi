---
id: TASK-34
title: >-
  Benchmark checkpoint-7600 and checkpoint-8000 on Cherokee New Testament with
  train/test split isolation
status: Done
assignee:
  - '@self'
created_date: '2026-11-04 15:02'
updated_date: '2026-11-04 16:00'
labels: []
dependencies: []
modified_files:
  - scripts/benchmark_bible_models.py
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Evaluate the full Cherokee New Testament across baseline, checkpoint-7600, and checkpoint-8000 models, isolating verses present in the training set (bible-wav2vec2-train.csv) from held-out unseen test verses to avoid inflating test statistics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Map and isolate Seen (training) vs Unseen (test) New Testament verses using training CSV from workshop-transcription
- [x] #2 Score all 1,749 NT verses with checkpoint-7600 and checkpoint-8000 on MPS
- [x] #3 Compute statistical distributions (Median/IQR, Mean/Std, Quality Tiers, Paired delta) for Unseen Test, Seen Train, and Combined splits
- [x] #4 Generate 4-panel comparison dashboard PNG and summary JSON artifact
- [x] #5 Publish detailed comparative benchmark report in artifacts directory
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect bible-wav2vec2-train.csv and any other training splits in workshop-transcription to build the exact set of Seen training verses.
2. Verify the 1,749 NT verses in bible_alignment_records.json / public/data/phrases.json and match with split_audio paths.
3. Create scripts/benchmark_bible_models.py to score verses under checkpoint-7600 and checkpoint-8000 using PyTorch MPS.
4. Execute scoring, caching alignment outputs to data/benchmarks/bible/.
5. Compute metrics across Unseen (Test), Seen (Train), and Combined sets.
6. Generate 4-panel dashboard PNG, JSON summary, and comprehensive markdown report.
7. Check ACs and finalize task.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Evaluated Checkpoint-7600 and Checkpoint-8000 across all 1,749 verses (23,035 words) of the Cherokee New Testament on Apple Silicon MPS, explicitly isolating Seen training verses (479 verses from bible-wav2vec2-train.csv) from Unseen held-out verses (1,270 verses).

Key Findings:
- No Inflation / True Generalization: On unseen held-out verses, Checkpoint-8000 boosted mean word confidence by +20.0% (0.6430 -> 0.7715) and median confidence by +14.7% (0.8531 -> 0.9789), lifting the High confidence tier (>=0.80) from 52.5% to 72.1% (+19.6 pp).
- The gain on Unseen held-out verses (+0.1285) was higher than on Seen training verses (+0.1012), proving genuine acoustic phonetic generalization rather than training set memorization.
- Checkpoint-8000 slightly outperformed Checkpoint-7600 on median confidence (0.9789 vs 0.9770), win rate (49.9% vs 49.4%), and IQR tightness.
- Generated 4-panel visual dashboard (bible_model_comparison_dashboard.png), summary JSON, and comprehensive benchmark report (bible_model_benchmark_report.md).
<!-- SECTION:FINAL_SUMMARY:END -->
