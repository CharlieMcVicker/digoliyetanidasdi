#!/usr/bin/env python3
"""
Re-slice all 1,749 Cherokee New Testament Bible verses from continuous chapter audio
based on the latest alignment boundaries in bible_alignment_records.json.
Exports 16kHz mono WAV files to workshop-transcription/data/projects/cherokee_new_testament/split_audio.
"""

import json
import logging
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List
from pydub import AudioSegment

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

WORKSHOP_DIR = Path("/Users/julietmcvicker/code/workshop-transcription")
NT_DIR = WORKSHOP_DIR / "data/projects/cherokee_new_testament"
ALIGNMENTS_PATH = NT_DIR / "alignments/bible_alignment_records.json"
AUDIO_SRC_DIR = NT_DIR / "audio_source"
SPLIT_AUDIO_DIR = NT_DIR / "split_audio"


def reslice_all_verses() -> None:
    if not ALIGNMENTS_PATH.exists():
        raise FileNotFoundError(f"Bible alignment records not found: {ALIGNMENTS_PATH}")

    logger.info("Loading alignment records from %s", ALIGNMENTS_PATH)
    with open(ALIGNMENTS_PATH, "r", encoding="utf-8") as f:
        records: List[Dict[str, Any]] = json.load(f)

    # Group records by (book, chapter)
    chapter_map: Dict[tuple[str, int], List[Dict[str, Any]]] = defaultdict(list)
    for r in records:
        chapter_map[(r["book"].lower(), int(r["chapter"]))].append(r)

    logger.info("Found %d records across %d chapters", len(records), len(chapter_map))
    SPLIT_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    t_start = time.time()
    total_exported = 0

    sorted_chapters = sorted(chapter_map.keys(), key=lambda x: (x[0], x[1]))

    for book, ch in sorted_chapters:
        ch_records = sorted(chapter_map[(book, ch)], key=lambda x: int(x["verse_idx"]))
        audio_src = AUDIO_SRC_DIR / f"{book}_{ch:02d}.mp3"
        if not audio_src.exists():
            logger.error("Missing chapter source audio: %s", audio_src)
            continue

        t0 = time.time()
        # Load and convert to 16kHz mono
        chapter_seg = (
            AudioSegment.from_file(str(audio_src))
            .set_frame_rate(16000)
            .set_channels(1)
        )
        ch_len_ms = len(chapter_seg)

        for rec in ch_records:
            v_idx = int(rec["verse_idx"])
            s_sec = float(rec["start_sec"])
            e_sec = float(rec["end_sec"])

            s_ms = max(0, int(round(s_sec * 1000)))
            e_ms = min(ch_len_ms, max(s_ms, int(round(e_sec * 1000))))

            verse_seg = chapter_seg[s_ms:e_ms]
            out_filename = f"{book}_{ch:02d}_{v_idx:02d}.wav"
            out_path = SPLIT_AUDIO_DIR / out_filename
            verse_seg.export(str(out_path), format="wav")
            total_exported += 1

        logger.info(
            "Exported %2d verses for %s %02d (source: %.1fs) in %.2fs",
            len(ch_records),
            book.capitalize(),
            ch,
            ch_len_ms / 1000.0,
            time.time() - t0,
        )

    logger.info(
        "Successfully re-sliced %d Bible verse WAVs in %.2fs",
        total_exported,
        time.time() - t_start,
    )


if __name__ == "__main__":
    reslice_all_verses()
