---
id: TASK-32
title: >-
  Benchmark checkpoint-7600 and checkpoint-8000 on full Dictionary against
  baseline
status: Done
assignee:
  - '@self'
created_date: '2026-11-04 14:09'
updated_date: '2026-11-04 14:17'
labels: []
dependencies: []
modified_files:
  - scripts/benchmark_dictionary_models.py
  - .gitignore
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Evaluate alignment confidence distributions for checkpoint-7600 (Conversational & Bible Winner) and checkpoint-8000 (Bible Specialist Winner) on all 1,857 sentences of the 1975 Durbin Feeling Dictionary against the baseline model. Generate comparative distribution graphics, statistical summaries (Median/IQR, Mean/Std, Quality tiers, and paired deltas), and report findings to guide downstream evaluation on Bible and Saving the Voices.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Run full CTC forced alignment scoring on 1,857 dictionary sentences for checkpoint-7600
- [x] #2 Run full CTC forced alignment scoring on 1,857 dictionary sentences for checkpoint-8000
- [x] #3 Extract paired sentence and word-level metrics against baseline
- [x] #4 Generate comparative distribution figures (KDE/histogram, boxplot, paired delta waterfall) in artifacts
- [x] #5 Publish comparative analysis report documenting findings and model selection recommendation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Write benchmarking script scripts/benchmark_dictionary_models.py to score 1,857 dictionary sentences across baseline, checkpoint-7600, and checkpoint-8000 using PyTorch MPS/CPU acceleration.
2. Execute scoring for checkpoint-7600 and checkpoint-8000 and cache alignments/confidence metrics.
3. Compute paired distributional stats (Mean, Median, IQR, P10/P90, Quality Tiers, Paired Deltas).
4. Generate multi-panel comparison figure in artifact directory.
5. Write detailed analysis report and recommend next evaluation steps.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Evaluated checkpoint-7600 and checkpoint-8000 against baseline on all 1,857 sentences (7,205 words) of the 1975 Durbin Feeling Dictionary using PyTorch MPS on Apple Silicon (91.7s per model, 20.2 sent/s).

Key Findings:
- Median word confidence remains high across all three models: Baseline 0.9967, Chkpt-7600 0.9877, Chkpt-8000 0.9892.
- Approximately 50% of dictionary words are identical/tied (|delta| <= 0.02) to the baseline.
- Checkpoint-8000 edges out Checkpoint-7600 with +0.78% higher mean confidence (0.8914 vs 0.8836), higher 10th percentile floor (0.4358 vs 0.4062), lower failure rate (1.24% vs 1.46%), and tighter IQR.
- Generated 4-panel visual dashboard (dict_model_comparison_dashboard.png) and published comprehensive report (dict_model_benchmark_report.md).
<!-- SECTION:FINAL_SUMMARY:END -->
