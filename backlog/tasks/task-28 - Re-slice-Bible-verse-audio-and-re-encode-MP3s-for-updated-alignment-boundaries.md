---
id: TASK-28
title: Re-slice Bible verse audio and re-encode MP3s for updated alignment boundaries
status: Done
assignee:
  - '@self'
created_date: '2026-11-02 18:45'
updated_date: '2026-11-02 18:58'
labels: []
dependencies: []
modified_files:
  - scripts/reslice_bible.py
  - scripts/convert_to_mp3.py
  - scripts/build_corpus.py
  - scripts/generate_analysis_figures.py
  - public/data/phrases.json
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Re-slice all 1,749 Bible verse audio files from the source chapter audio using the updated verse boundaries [start_sec, end_sec] in bible_alignment_records.json. Re-encode the sliced WAVs to MP3 in audio_mp3/split_audio/, rebuild public corpus phrases.json, and verify accurate word playback timing on Mark 15:42 (nhski) and other verses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All Bible verses in split_audio are re-sliced to match bible_alignment_records.json start_sec and end_sec boundaries
- [x] #2 All split_audio MP3s in audio_mp3/split_audio/ are updated from the new WAV slices
- [x] #3 phrases.json is rebuilt and audio durations match physical audio slice durations
- [x] #4 Word playback timing for Mark 15:42 (nhski) and sample verses verified to contain speech rather than silence
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Write and run a python script to re-slice split_audio WAVs from chapter source audio using bible_alignment_records.json boundaries
2. Re-encode split_audio WAV files to MP3 in audio_mp3/split_audio/
3. Rebuild public corpus phrases.json and verify audio_end matches duration
4. Acoustically verify Mark 15:42 (nhski) and sample verses have speech energy at word intervals
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Re-sliced all 1,749 Cherokee New Testament Bible verse WAV clips from continuous chapter audio to match the realigned verse boundaries in bible_alignment_records.json. Re-encoded all split_audio WAVs to speech-optimized MP3s in audio_mp3/split_audio/, rebuilt public corpus data (17,463 phrases across Dictionary, Bible, and Saving the Voices), verified acoustic speech energy and HTTP streaming for Mark 15:42 (nhski), and generated 3-source sentence length vs confidence and side-by-side NT alignment comparison figures.
<!-- SECTION:FINAL_SUMMARY:END -->
