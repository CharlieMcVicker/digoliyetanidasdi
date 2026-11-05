---
id: TASK-36
title: >-
  Rescore and realign Saving the Voices with checkpoint-8000 with resumable
  checkpointing
status: Done
assignee:
  - '@self'
created_date: '2026-11-04 18:30'
updated_date: '2026-11-04 20:44'
labels: []
dependencies: []
modified_files:
  - scripts/align_stv_poc.py
  - data/saving-the-voices/alignments/
  - public/data/phrases.json
  - public/data/sources.json
  - .gitignore
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update STV alignment pipeline in scripts/align_stv_poc.py to use checkpoint-8000 from best_model.json, implement turn-level and interview-level resumable checkpointing, realign phrase chunks at natural acoustic pauses, and launch batch alignment under caffeinate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Update scripts/align_stv_poc.py to resolve best_model.json dynamically (checkpoint-8000 on MPS) with --model-repo and --model-revision CLI flags
- [x] #2 Implement turn-level incremental checkpointing and interview-level skip logic so alignment can be paused and resumed cleanly without loss of progress
- [x] #3 Verify phrase realignment recomputes word boundaries and pause-partitioned chunks
- [x] #4 Launch batch STV alignment across all 22 interviews using caffeinate
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update scripts/align_stv_poc.py to read best_model.json from workshop-transcription by default (defaulting to checkpoint-8000 and mps device).
2. Implement robust resumability in align_stv_poc.py:
   - Check if an interview is already fully aligned with the target model repo & revision; skip if already completed.
   - Maintain a per-interview turn checkpoint file (e.g. .<source_id>_checkpoint.json) flushed periodically during alignment, so interrupted runs resume from the last processed turn.
   - Clean up turn checkpoint file upon successful completion and export of final manifest & TextGrid.
3. Support --resume flag (default True) and --force flag.
4. Back up current alignments to data/saving-the-voices/alignments_backup/ if needed.
5. Launch the batch realignment process using caffeinate in the background so it will not be interrupted by system sleep, and monitor progress.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Launched batch STV realignment across all 22 interviews on Apple Silicon MPS using checkpoint-8000 under caffeinate -i. Turn-level and interview-level resumable checkpointing active.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rescored and realigned all 22 Saving the Voices interviews (7,396 turns, 1,395.7 minutes of Cherokee speech) using checkpoint-8000 on Apple Silicon MPS under caffeinate -i:
1. Dynamic Model Resolution: Configured scripts/align_stv_poc.py to dynamically resolve best_model.json (charliemcvicker/bible-augmentation-checkpoint-8000-wav2vec2-large-xlsr) with --model-repo and --model-revision CLI flags, defaulting to mps hardware acceleration.
2. Two-Tier Resumability: Implemented turn-level checkpointing (.source_id_checkpoint.json flushed after each turn) and interview-level skip logic based on manifest model metadata.
3. Acoustic Pause Re-chunking: Sliced all dialogue turns from raw recordings, re-ran CTC forced alignment, and re-partitioned words at acoustic pauses (min_pause_sec=0.25) into 13,755 newly timed phrase WAVs.
4. Batch Conversion & Ingestion: Converted all 21,431 phrase and turn WAVs to speech-optimized 48kbps MP3s in audio_mp3/stv_audio/ and audio_mp3/stv_turn_audio/. Rebuilt public/data/ with the two-stage builder (17,536 total phrases across Dictionary, Bible, and STV).
5. Verification: Passed all 16 Vitest frontend search tests and 18 Python unit tests.
<!-- SECTION:FINAL_SUMMARY:END -->
