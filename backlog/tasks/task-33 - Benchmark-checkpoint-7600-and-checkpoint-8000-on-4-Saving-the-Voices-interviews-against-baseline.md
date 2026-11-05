---
id: TASK-33
title: >-
  Benchmark checkpoint-7600 and checkpoint-8000 on 4 Saving the Voices
  interviews against baseline
status: Done
assignee:
  - '@self'
created_date: '2026-11-04 14:19'
updated_date: '2026-11-04 14:56'
labels: []
dependencies: []
modified_files:
  - scripts/benchmark_stv_models.py
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Evaluate alignment confidence distributions for checkpoint-7600 (Conversational & Bible Winner) and checkpoint-8000 (Bible Specialist Winner) on 4 diverse Saving the Voices interviews (stv_0003_dj_vann, stv_0005_martin_ballou, stv_0010_mary_mccoy, stv_0011_naomi_stone; 859 turns, 11,789 words, 189.7 min speech) against the baseline model. Generate comparative distribution graphics, statistical summaries (Median/IQR, Mean/Std, Quality tiers, paired deltas, and colloquial syncopated token shifts), and publish report to determine model selection for field dialogues.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Score all 859 turns across 4 STV interviews with checkpoint-7600 on MPS
- [x] #2 Score all 859 turns across 4 STV interviews with checkpoint-8000 on MPS
- [x] #3 Compute paired word and turn-level metrics against baseline
- [x] #4 Analyze colloquial/syncopated Cherokee token shifts (skina, skwu, kehv, tsikehv, ohsta, yuhsti)
- [x] #5 Generate comparative 4-panel dashboard and publish comprehensive analysis report
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Write benchmarking script scripts/benchmark_stv_models.py targeting stv_0003, stv_0005, stv_0010, and stv_0011.
2. Run CTC forced alignment scoring for checkpoint-7600 and checkpoint-8000 using PyTorch MPS.
3. Compute paired word-level, turn-level, and colloquial syncopated token shifts.
4. Generate 4-panel dashboard in artifacts (stv_model_comparison_dashboard.png).
5. Write benchmark analysis report (stv_model_benchmark_report.md) with model selection recommendation.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Evaluated checkpoint-7600 and checkpoint-8000 against baseline on 4 diverse Saving the Voices interviews (859 turns, 11,789 words, 189.7 min speech) using PyTorch MPS on Apple Silicon.

Key Findings:
- Both models deliver a massive +21.4% boost in mean word confidence over baseline (0.2566 -> 0.3114) and a +55.8% jump in median word confidence (0.0779 -> 0.1214 / 0.1185).
- High confidence tier words (>=80%) increased by +32.5% (14.83% -> 19.66%), while severe unaligned words (<5%) dropped by 6.07% absolute.
- On syncopated Cherokee words, skina surged +96.2% (0.2299 -> 0.4500), tsikehv surged +65.7% (0.2439 -> 0.4041), and yuhsti more than doubled (0.1343 -> 0.2808).
- Across both Dictionary and STV, Checkpoint-8000 demonstrates the strongest overall profile (strictly beating 7600 on Dictionary citation speech while matching 7600 on conversational speech and leading on key syncopated tokens like skwu and tsikehv).
- Generated 4-panel dashboard (stv_model_comparison_dashboard.png) and published comprehensive report (stv_model_benchmark_report.md).
<!-- SECTION:FINAL_SUMMARY:END -->
