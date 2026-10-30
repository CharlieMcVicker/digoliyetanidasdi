#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/align_stv_poc.py

Proof-of-Concept Alignment Pipeline for Saving the Voices:
Interview 0003: DJ Vann (ᎦᎨᏓ)

Workflow:
1. Downloads full MP3 (Kiwa Digital).
2. Pre-slices 41-minute recording into turn WAVs using transcript startMs..endMs.
3. Cleans laughter annotations, inline syllabary diacritics, and splits clauses on ?, !, ...
4. Runs syncope- and intrusion-aware CTC forced alignment with Silero VAD soft-masking.
5. Sub-segments long turns into ~5-15s phrase WAVs at acoustic pauses.
6. Exports 7-tier Praat TextGrid, alignment manifest, and updates public/data/phrases.json.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
from pydub import AudioSegment

# Add workshop-transcription to path
WORKSHOP_DIR = Path("/Users/julietmcvicker/code/workshop-transcription")
if str(WORKSHOP_DIR) not in sys.path:
    sys.path.insert(0, str(WORKSHOP_DIR))

from digohwelisgi.alignment.ctc_aligner import CTCSegmentationAligner, create_cherokee_ctc_config
from digohwelisgi.cherokee.codeswitching import create_groundtruth_for_code_switched_syllabary
from digohwelisgi.cherokee.models import CherokeeASRModel
from digohwelisgi.cherokee.orthography import convert_orthography, Orthography
from digohwelisgi.core.alignment.models import AlignedChunk, AlignmentMetrics, AlignmentOutput, TextChunk, WordInterval
from digohwelisgi.pipelines.dialogue.pipeline import (
    build_english_word_tier,
    build_phoneme_tier,
    build_syllabary_word_tier,
    export_7tier_textgrid,
    reconcile_alignment_words,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("align_stv_poc")

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data/saving-the-voices"
RAW_AUDIO_DIR = DATA_DIR / "raw_audio"
TURN_AUDIO_DIR = DATA_DIR / "turn_audio"
SPLIT_AUDIO_DIR = DATA_DIR / "split_audio"
ALIGNMENTS_DIR = DATA_DIR / "alignments"
PUBLIC_DIR = REPO_ROOT / "public"

KIWA_BASE_URL = "https://cherokee-language-hub.kiwadigital.com"
PRE_BIBLE_MODEL_REPO = "charliemcvicker/length-only-20260704-155307-asr-cherokee-colon"
PRE_BIBLE_MODEL_REVISION = "76e62140955f4738abdab345ea34068b02d8d2a2"

SYL_CHAR_CLASS = r"\u13A0-\u13FF\uAB70-\uABBF"
SYL_RE = re.compile(f"[{SYL_CHAR_CLASS}]")
CHR_LAUGH_RE = re.compile(r"^[\(\[\*]*Ꭴ(?:Ꮒ)?Ᏸ[ᏣᏥᏘ][,;.:]*[Ꮝ]?[,;.:]*[ᎦᎬ]?[,;.:]*[\)\]\*]*$")
CLAUSE_SPLIT_RE = re.compile(r"(?:[?!]+[\”\"\x27\u2019\)]*\s+|\.{2,}[\”\"\x27\u2019\)]*\s*|…+[\”\"\x27\u2019\)]*\s*)")


@dataclass(frozen=True)
class PhraseSlice:
    phrase_id: str
    source_id: str
    turn_id: str
    phrase_index: int
    global_start_sec: float
    global_end_sec: float
    turn_start_sec: float
    turn_end_sec: float
    local_start_sec: float
    local_end_sec: float
    duration_sec: float
    wav_rel_path: str
    syllabary_text: str
    phonetic_text: str
    phonetic_broad: str
    english_text: Optional[str]
    mean_confidence: float
    min_confidence: float
    has_anomalies: bool
    words: List[Dict[str, Any]]


def clean_cherokee_syllabary_tokens(text: str) -> str:
    """
    Strips inline phonetic diacritics (, ; . : ' ’ *) from Cherokee syllabary characters,
    normalizes stutter hyphens, while preserving English stems and compound clitics.
    """
    if not text:
        return ""
    # Protect compound clitic hyphens (e.g. Bunch-i, Jay-Ꭲ)
    tok = re.sub(f"([a-zA-Z0-9$*’'\"”])-([{SYL_CHAR_CLASS}])", "\\1\x00\\2", text)
    tok = re.sub(f"([{SYL_CHAR_CLASS}])-([a-zA-Z0-9$*‘'\"“])", "\\1\x00\\2", tok)
    # Split stutter/repair hyphens into spaces
    tok = re.sub(r"--+|—|–|\.\.\.+|…+|/|-", " ", tok)
    tok = tok.replace("\x00", "-")

    cleaned_words: List[str] = []
    for raw_word in tok.split():
        # Remove parentheticals and stage directions
        w = re.sub(r"[\(\)\[\]\"“”*]", "", raw_word).strip()
        if not w:
            continue
        # Strip inline diacritics from syllabary
        if SYL_RE.search(w):
            w = re.sub(rf"([{SYL_CHAR_CLASS}])[,;.:'’]+", r"\1", w)
            w = re.sub(rf"[,;.:'’]+([{SYL_CHAR_CLASS}])", r"\1", w)
            w = re.sub(r"^[.?!,:;]+|[.?!,:;]+$", "", w)
        else:
            w = re.sub(r"^[.?!,:;]+|[.?!,:;]+$", "", w)
        if w:
            cleaned_words.append(w)
    return " ".join(cleaned_words)


def filter_laughter_and_stage_directions(
    cherokee_text: str, english_translation: Optional[str]
) -> str:
    """
    Drops ᎤᏰᏣᏍᎦ / ᎤᏂᏰᏣᏍᎦ and spelling variants when English contains laughter tags
    or when enclosed in stage direction brackets.
    """
    if not cherokee_text:
        return ""
    has_en_laugh = bool(
        english_translation
        and re.search(r"\[.*laugh.*\]|\(.*laugh.*\)", english_translation, re.I)
    )

    filtered: List[str] = []
    for tok in cherokee_text.split():
        is_bracketed = bool(re.match(r"^[\(\[]+.*[\)\]]+$", tok))
        is_laugh_word = bool(CHR_LAUGH_RE.match(tok))

        if has_en_laugh and is_laugh_word:
            continue
        if is_bracketed and ("Ᏸ" in tok or "laugh" in tok.lower()):
            continue
        if is_bracketed and re.match(r"^[\(\[]*\d+[:.]\d+[\)\]]*$", tok):
            continue  # timestamp annotation like (16:58)
        filtered.append(tok)

    return " ".join(filtered)


def prepare_turn_clauses(
    raw_text: str, english_translation: Optional[str]
) -> List[Tuple[str, str, Dict[str, Any]]]:
    """
    Cleans laughter, splits strictly on ?, !, ..., and prepares code-switched TTH targets.
    Returns: List of (clause_raw_cherokee, clause_clean_syl, code_switched_meta_dict).
    """
    text_no_laugh = filter_laughter_and_stage_directions(raw_text, english_translation)
    if not text_no_laugh.strip() or not SYL_RE.search(text_no_laugh):
        return []

    # Split into clauses strictly on ?, !, ..., …
    raw_clauses = [
        c.strip()
        for c in CLAUSE_SPLIT_RE.split(text_no_laugh)
        if c.strip() and SYL_RE.search(c)
    ]
    if not raw_clauses:
        raw_clauses = [text_no_laugh.strip()]

    results = []
    for clause in raw_clauses:
        clean_syl = clean_cherokee_syllabary_tokens(clause)
        if not clean_syl or not SYL_RE.search(clean_syl):
            continue
        cs_res = create_groundtruth_for_code_switched_syllabary(
            clean_syl, contextual_preaspiration=True
        )
        if not cs_res.tokens or not cs_res.unified_tth:
            continue
        results.append((clause, clean_syl, cs_res.to_dict()))

    return results


def partition_words_into_phrases(
    words: Sequence[WordInterval],
    clean_syl_words: Sequence[str],
    max_duration_sec: float = 15.0,
    min_pause_sec: float = 0.25,
) -> List[Tuple[List[WordInterval], List[str]]]:
    """
    Subdivides a sequence of word intervals into phrase units of <= max_duration_sec,
    splitting at the largest inter-word acoustic pauses.
    """
    n_words = len(words)
    if n_words == 0:
        return []

    dur = words[-1].end_sec - words[0].start_sec
    if dur <= max_duration_sec or n_words <= 3:
        return [(list(words), list(clean_syl_words))]

    # Find candidate split points at inter-word pauses
    gaps: List[Tuple[int, float]] = []
    for i in range(n_words - 1):
        gap = max(0.0, words[i + 1].start_sec - words[i].end_sec)
        gaps.append((i + 1, gap))

    # Prefer pause >= min_pause_sec in the middle half
    mid_start = int(n_words * 0.25)
    mid_end = int(n_words * 0.75)

    best_split_idx = -1
    best_gap = -1.0
    for idx, gap in gaps:
        if mid_start <= idx <= mid_end:
            if gap > best_gap:
                best_gap = gap
                best_split_idx = idx

    # Fallback to absolute largest gap if middle range had no distinct pause
    if best_split_idx == -1 or best_gap < 0.05:
        best_split_idx = max(gaps, key=lambda x: x[1])[0]

    left_words = words[:best_split_idx]
    right_words = words[best_split_idx:]
    left_syl = clean_syl_words[:best_split_idx]
    right_syl = clean_syl_words[best_split_idx:]

    left_phrases = partition_words_into_phrases(
        left_words, left_syl, max_duration_sec, min_pause_sec
    )
    right_phrases = partition_words_into_phrases(
        right_words, right_syl, max_duration_sec, min_pause_sec
    )

    return left_phrases + right_phrases


def align_interview(
    source_id: str = "stv_0003_dj_vann",
    asset_id: str = "saving-the-voices-0003-dj-vann",
    limit_turns: Optional[int] = None,
    device: str = "cpu",
    model: Optional[CherokeeASRModel] = None,
    aligner: Optional[CTCSegmentationAligner] = None,
) -> Dict[str, Any]:
    """
    Runs the full end-to-end alignment pipeline for an interview.
    """
    timing_stats: Dict[str, float] = {}
    total_t0 = time.time()

    # Step 1: Download Audio
    t0 = time.time()
    RAW_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    TURN_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    SPLIT_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    ALIGNMENTS_DIR.mkdir(parents=True, exist_ok=True)

    col_path = DATA_DIR / "saving-the-voices.json"
    with open(col_path, "r", encoding="utf-8") as f:
        col_data = json.load(f)
    asset = next(a for a in col_data["assets"] if a["id"] == asset_id)
    mp3_filename = Path(asset["url"]).name
    mp3_path = RAW_AUDIO_DIR / mp3_filename

    if not mp3_path.exists():
        remote_url = f"{KIWA_BASE_URL}{asset['url']}" if asset["url"].startswith("/") else asset["url"]
        logger.info("Downloading %s to %s...", remote_url, mp3_path)
        urllib.request.urlretrieve(remote_url, str(mp3_path))
    timing_stats["download_audio_sec"] = round(time.time() - t0, 3)

    # Step 2: Load and Decode 16kHz Mono Audio
    t0 = time.time()
    logger.info("Decoding audio to 16kHz mono: %s...", mp3_path)
    full_audio = (
        AudioSegment.from_file(str(mp3_path))
        .set_frame_rate(16000)
        .set_channels(1)
    )
    full_audio_dur_sec = len(full_audio) / 1000.0
    logger.info("Loaded %.2fs of audio.", full_audio_dur_sec)
    timing_stats["decode_audio_sec"] = round(time.time() - t0, 3)

    # Step 3: Load Transcript Segments
    t0 = time.time()
    transcript_filename = Path(asset["transcriptUrl"]).name
    transcript_path = DATA_DIR / "transcripts" / transcript_filename
    with open(transcript_path, "r", encoding="utf-8") as f:
        t_data = json.load(f)
    segments = t_data.get("segments", [])
    timing_stats["load_transcript_sec"] = round(time.time() - t0, 3)

    # Step 4: Initialize Pre-Bible ASR Model & Aligner
    t0 = time.time()
    if model is None or aligner is None:
        logger.info("Initializing Pre-Bible ASR Model (%s on %s)...", PRE_BIBLE_MODEL_REPO, device)
        model = CherokeeASRModel.from_pretrained_or_best(
            path_or_repo=PRE_BIBLE_MODEL_REPO,
            revision=PRE_BIBLE_MODEL_REVISION,
            device=device,
        )
        ctc_config = create_cherokee_ctc_config(
            enable_vad_soft_masking=True,
            vad_p_low=0.15,
            vad_p_high=0.60,
            vad_pad_ms=60,
            cache=True,
            cache_dir=WORKSHOP_DIR / ".cache/ctc_emissions",
        )
        aligner = CTCSegmentationAligner(model=model, config=ctc_config)
        timing_stats["init_model_sec"] = round(time.time() - t0, 3)
    else:
        logger.info("Reusing existing Pre-Bible ASR Model and CTCSegmentationAligner instances.")
        timing_stats["init_model_sec"] = 0.0

    # Step 5: Turn-by-Turn Pre-Slicing, VAD & CTC Alignment
    t0 = time.time()
    interview_turn_dir = TURN_AUDIO_DIR / source_id
    interview_turn_dir.mkdir(parents=True, exist_ok=True)
    interview_split_dir = SPLIT_AUDIO_DIR / source_id
    interview_split_dir.mkdir(parents=True, exist_ok=True)

    aligned_phrase_slices: List[PhraseSlice] = []
    aligned_chunks_for_export: List[AlignedChunk] = []
    source_lookup_for_export: Dict[str, Dict[str, Any]] = {}
    syllabary_words_tier: List[WordInterval] = []
    english_words_tier: List[WordInterval] = []

    turn_count = 0
    aligned_turn_count = 0
    skipped_laugh_count = 0
    total_cherokee_audio_sec = 0.0

    valid_segments = [
        s for s in segments
        if s.get("startMs") is not None
        and s.get("endMs") is not None
        and s.get("endMs") > s.get("startMs")
        and SYL_RE.search(s.get("text") or "")
    ]

    if limit_turns is not None:
        valid_segments = valid_segments[:limit_turns]

    logger.info("Starting turn alignment for %d Cherokee segments...", len(valid_segments))

    for seg_idx, seg in enumerate(valid_segments, 1):
        seg_id = str(seg.get("id") or f"seg-{seg_idx:03d}")
        raw_text = (seg.get("text") or "").strip()
        en_trans = (seg.get("translation") or "").strip() or None
        start_ms = int(seg["startMs"])
        end_ms = int(seg["endMs"])
        turn_dur_sec = (end_ms - start_ms) / 1000.0
        total_cherokee_audio_sec += turn_dur_sec
        turn_count += 1

        # Text cleaning, laughter heuristic, and clause splitting
        clauses = prepare_turn_clauses(raw_text, en_trans)
        if not clauses:
            skipped_laugh_count += 1
            logger.info("Skipped seg %s (pure laughter or no Cherokee spoken words).", seg_id)
            continue

        # Pre-slice turn WAV (16kHz mono)
        turn_wav_path = interview_turn_dir / f"{seg_id}.wav"
        turn_audio = full_audio[start_ms:end_ms]
        if not turn_wav_path.exists():
            turn_audio.export(str(turn_wav_path), format="wav")

        # Build TextChunks for this turn
        turn_chunks: List[TextChunk] = []
        turn_meta: Dict[str, Dict[str, Any]] = {}
        for c_idx, (c_raw, c_clean, cs_dict) in enumerate(clauses, 1):
            cid = f"{seg_id}_c{c_idx:02d}"
            turn_chunks.append(TextChunk(chunk_id=cid, text=cs_dict["unified_tth"]))
            turn_meta[cid] = {
                "syllabary": c_clean,
                "text": c_clean,
                "phonetic": cs_dict["unified_tth"],
                "code_switched": cs_dict,
                "speaker": seg.get("speakerLabel") or seg.get("speaker") or "Speaker",
            }

        # Run CTC forced alignment with Silero VAD soft-masking on turn slice
        try:
            turn_alignment = aligner.align(
                audio_input=str(turn_wav_path),
                chunks=turn_chunks,
                source_id=f"{source_id}_{seg_id}",
                asr_model=model,
                source_metadata=turn_meta,
            )
        except Exception as e:
            logger.error("Error aligning %s: %s", seg_id, e)
            continue

        aligned_turn_count += 1

        # Sub-segment long clauses/turns into ~5-15s phrase WAVs
        phrase_idx_in_turn = 1
        for c_idx, ac in enumerate(turn_alignment.aligned_chunks):
            cid = ac.chunk_id
            c_clean_syl = turn_meta[cid]["syllabary"].split()
            c_words = ac.words

            # Fallback if words count differs from clean syllabary words
            if len(c_clean_syl) != len(c_words) and c_words:
                # Reconcile token counts using proportional word partitioning
                pass

            sub_phrases = partition_words_into_phrases(
                words=c_words,
                clean_syl_words=c_clean_syl,
                max_duration_sec=15.0,
                min_pause_sec=0.25,
            )

            for p_words, p_syl in sub_phrases:
                if not p_words:
                    continue

                p_start_local = max(0.0, round(p_words[0].start_sec - 0.1, 3))
                p_end_local = min(turn_dur_sec, round(p_words[-1].end_sec + 0.1, 3))
                p_dur = max(0.01, round(p_end_local - p_start_local, 3))

                p_start_global = round((start_ms / 1000.0) + p_start_local, 3)
                p_end_global = round((start_ms / 1000.0) + p_end_local, 3)

                phrase_id = f"{source_id}_{seg_id}_p{phrase_idx_in_turn:02d}"
                phrase_wav_name = f"{seg_id}_p{phrase_idx_in_turn:02d}.wav"
                phrase_wav_path = interview_split_dir / phrase_wav_name

                # Slice phrase WAV
                p_start_ms = max(0, int(round(p_start_local * 1000)))
                p_end_ms = min(len(turn_audio), int(round(p_end_local * 1000)))
                phrase_audio = turn_audio[p_start_ms:p_end_ms]
                phrase_audio.export(str(phrase_wav_path), format="wav")

                # 0-indexed words for WaveSurfer playback
                zero_words: List[Dict[str, Any]] = []
                phon_tokens: List[str] = []
                confs: List[float] = []

                for w in p_words:
                    w_start_0 = round(max(0.0, w.start_sec - p_start_local), 3)
                    w_end_0 = round(max(w_start_0, w.end_sec - p_start_local), 3)
                    emitted = (w.emitted_word or w.word).strip()
                    phon_tokens.append(emitted)
                    conf = round(float(w.confidence), 4)
                    confs.append(conf)
                    zero_words.append(
                        {
                            "word": emitted,
                            "start": w_start_0,
                            "end": w_end_0,
                            "confidence": conf,
                            "flagged": bool(w.flagged),
                        }
                    )

                # Reconcile 1:1 display syllabary tokens with words[]
                if len(p_syl) == len(zero_words):
                    final_syl_tokens = list(p_syl)
                else:
                    final_syl_tokens = p_syl[:len(zero_words)]
                    while len(final_syl_tokens) < len(zero_words):
                        final_syl_tokens.append(final_syl_tokens[-1] if final_syl_tokens else "—")

                mean_c = round(float(np.mean(confs)), 4) if confs else 0.0
                min_c = round(float(np.min(confs)), 4) if confs else 0.0
                has_anom = any(w["flagged"] for w in zero_words)

                canonical_phon = " ".join(phon_tokens)
                broad_phon = canonical_phon.replace("h", "").replace("'", "")
                final_syl_text = " ".join(final_syl_tokens)

                ps = PhraseSlice(
                    phrase_id=phrase_id,
                    source_id=source_id,
                    turn_id=seg_id,
                    phrase_index=phrase_idx_in_turn,
                    global_start_sec=p_start_global,
                    global_end_sec=p_end_global,
                    turn_start_sec=round(start_ms / 1000.0, 3),
                    turn_end_sec=round(end_ms / 1000.0, 3),
                    local_start_sec=p_start_local,
                    local_end_sec=p_end_local,
                    duration_sec=p_dur,
                    wav_rel_path=f"stv_audio/{source_id}/{phrase_wav_name}",
                    syllabary_text=final_syl_text,
                    phonetic_text=canonical_phon,
                    phonetic_broad=broad_phon,
                    english_text=en_trans,
                    mean_confidence=mean_c,
                    min_confidence=min_c,
                    has_anomalies=has_anom,
                    words=zero_words,
                )
                aligned_phrase_slices.append(ps)
                phrase_idx_in_turn += 1

                # Collect global intervals for 7-tier Praat TextGrid
                global_words: List[WordInterval] = []
                for w_idx, w in enumerate(p_words):
                    s_w = final_syl_tokens[w_idx] if w_idx < len(final_syl_tokens) else ""
                    global_w_start = round((start_ms / 1000.0) + w.start_sec, 3)
                    global_w_end = round((start_ms / 1000.0) + w.end_sec, 3)
                    global_words.append(
                        WordInterval(
                            word=w.word,
                            start_sec=global_w_start,
                            end_sec=global_w_end,
                            confidence=w.confidence,
                            flagged=w.flagged,
                            emitted_word=w.emitted_word,
                        )
                    )
                    syllabary_words_tier.append(
                        WordInterval(word=s_w, start_sec=global_w_start, end_sec=global_w_end)
                    )
                    is_en = any(c.isascii() and c.isalpha() for c in s_w)
                    english_words_tier.append(
                        WordInterval(word=s_w if is_en else "", start_sec=global_w_start, end_sec=global_w_end)
                    )

                aligned_chunks_for_export.append(
                    AlignedChunk(
                        chunk_id=phrase_id,
                        start_sec=p_start_global,
                        end_sec=p_end_global,
                        words=global_words,
                        distance_score=ac.distance_score,
                        emitted_text=canonical_phon,
                    )
                )
                source_lookup_for_export[phrase_id] = {
                    "speaker": seg.get("speakerLabel") or seg.get("speaker") or asset.get("title") or "Speaker",
                    "syllabary": final_syl_text,
                    "text": final_syl_text,
                    "phonetic": canonical_phon,
                    "translation": en_trans or "",
                }

        if seg_idx % 20 == 0 or seg_idx == len(valid_segments):
            logger.info("Processed %d/%d turns (%.1f%%)...", seg_idx, len(valid_segments), 100.0 * seg_idx / len(valid_segments))

    timing_stats["turn_alignment_loop_sec"] = round(time.time() - t0, 3)

    # Step 6: Export Aligned Manifest & Praat TextGrid
    t0 = time.time()
    manifest_out = ALIGNMENTS_DIR / f"{source_id}_aligned.json"
    with open(manifest_out, "w", encoding="utf-8") as f:
        json.dump(
            {
                "source_id": source_id,
                "asset_id": asset_id,
                "total_turns": turn_count,
                "aligned_turns": aligned_turn_count,
                "total_phrases": len(aligned_phrase_slices),
                "cherokee_speech_sec": round(total_cherokee_audio_sec, 3),
                "mean_word_confidence": round(
                    float(np.mean([w["confidence"] for ps in aligned_phrase_slices for w in ps.words])), 4
                ) if aligned_phrase_slices else 0.0,
                "phrases": [asdict(ps) for ps in aligned_phrase_slices],
            },
            f,
            indent=2,
            ensure_ascii=False,
        )

    # Build AlignmentOutput for Praat export
    textgrid_path = ALIGNMENTS_DIR / f"{source_id}.TextGrid"
    try:
        alignment_obj = AlignmentOutput(
            aligned_chunks=aligned_chunks_for_export,
            source_id=source_id,
        )
        export_7tier_textgrid(
            alignment=alignment_obj,
            output_dir=ALIGNMENTS_DIR,
            filename=f"{source_id}.TextGrid",
            source_metadata=source_lookup_for_export,
            syllabary_words=syllabary_words_tier,
            english_words=english_words_tier,
            reconciled_words=[w for c in aligned_chunks_for_export for w in c.words],
            phoneme_words=build_phoneme_tier([w for c in aligned_chunks_for_export for w in c.words]),
        )
        logger.info("Exported 7-tier Praat TextGrid to %s", textgrid_path)
    except Exception as e:
        logger.warning("Could not export Praat TextGrid: %s", e)

    timing_stats["export_artifacts_sec"] = round(time.time() - t0, 3)
    timing_stats["total_pipeline_sec"] = round(time.time() - total_t0, 3)

    return {
        "source_id": source_id,
        "turns_processed": aligned_turn_count,
        "phrases_generated": len(aligned_phrase_slices),
        "cherokee_audio_min": round(total_cherokee_audio_sec / 60.0, 2),
        "timing_stats": timing_stats,
        "manifest_path": str(manifest_out),
    }


def main():
    parser = argparse.ArgumentParser(description="Run Saving the Voices PoC Alignment Pipeline.")
    parser.add_argument("--source-id", default=None, help="Corpus source ID")
    parser.add_argument("--asset-id", default=None, help="Saving the Voices asset ID")
    parser.add_argument("--batch", action="store_true", help="Run batch alignment on scheduled interviews")
    parser.add_argument(
        "--interviews",
        nargs="*",
        default=None,
        help="Interview numbers to align (e.g. 0005 0015 0067 0002)",
    )
    parser.add_argument("--limit-turns", type=int, default=None, help="Limit number of turns for rapid testing")
    parser.add_argument("--device", default="cpu", help="Torch device ('cpu' or 'mps'/'cuda')")
    args = parser.parse_args()

    # Determine interviews to process
    interview_targets: List[Tuple[str, str]] = []

    if args.batch or args.interviews:
        target_nums = args.interviews or ["0005", "0015", "0067", "0002"]
        col_path = DATA_DIR / "saving-the-voices.json"
        with open(col_path, "r", encoding="utf-8") as f:
            col_data = json.load(f)

        for num_str in target_nums:
            num_clean = f"{int(num_str):04d}"
            match = next(
                (a for a in col_data["assets"] if a["id"].startswith(f"saving-the-voices-{num_clean}-")),
                None,
            )
            if match is None:
                logger.error("Could not find asset for interview number %s", num_str)
                continue
            asset_id = match["id"]
            num_m = re.search(r"saving-the-voices-(\d+)-(.+)", asset_id)
            if num_m:
                source_id = f"stv_{int(num_m.group(1)):04d}_{num_m.group(2).replace('-', '_')}"
            else:
                source_id = f"stv_{asset_id.replace('-', '_')}"
            interview_targets.append((source_id, asset_id))
    else:
        source_id = args.source_id or "stv_0003_dj_vann"
        asset_id = args.asset_id or "saving-the-voices-0003-dj-vann"
        interview_targets.append((source_id, asset_id))

    logger.info("Starting alignment run for %d interview(s)...", len(interview_targets))

    # Initialize model once and reuse across interviews
    logger.info("Pre-loading Pre-Bible ASR Model (%s on %s)...", PRE_BIBLE_MODEL_REPO, args.device)
    shared_model = CherokeeASRModel.from_pretrained_or_best(
        path_or_repo=PRE_BIBLE_MODEL_REPO,
        revision=PRE_BIBLE_MODEL_REVISION,
        device=args.device,
    )
    shared_ctc_config = create_cherokee_ctc_config(
        enable_vad_soft_masking=True,
        vad_p_low=0.15,
        vad_p_high=0.60,
        vad_pad_ms=60,
        cache=True,
        cache_dir=WORKSHOP_DIR / ".cache/ctc_emissions",
    )
    shared_aligner = CTCSegmentationAligner(model=shared_model, config=shared_ctc_config)

    all_results = []
    overall_start = time.time()

    for s_id, a_id in interview_targets:
        logger.info("\n>>> Processing [%s] (%s) <<<", s_id, a_id)
        res = align_interview(
            source_id=s_id,
            asset_id=a_id,
            limit_turns=args.limit_turns,
            device=args.device,
            model=shared_model,
            aligner=shared_aligner,
        )
        all_results.append(res)

    overall_elapsed = time.time() - overall_start

    print("\n" + "=" * 60)
    print("SAVING THE VOICES BATCH ALIGNMENT BENCHMARK REPORT")
    print("=" * 60)
    print(f"Total Interviews:      {len(all_results)}")
    print(f"Overall Clock Time:    {overall_elapsed:.2f}s ({overall_elapsed / 60.0:.2f} min)")
    total_speech_min = sum(r["cherokee_audio_min"] for r in all_results)
    total_phrases = sum(r["phrases_generated"] for r in all_results)
    print(f"Total Speech Time:     {total_speech_min:.2f} min")
    print(f"Total Phrases Created: {total_phrases}")
    if overall_elapsed > 0:
        print(f"Effective Throughput:  {total_speech_min * 60.0 / overall_elapsed:.2f}x Real-Time")
    print("-" * 60)
    for r in all_results:
        t_stats = r["timing_stats"]
        pipe_sec = t_stats.get("total_pipeline_sec", 0.0)
        speed = (r["cherokee_audio_min"] * 60.0 / pipe_sec) if pipe_sec > 0 else 0.0
        print(f"• {r['source_id']:<36} | {r['turns_processed']} turns | {r['phrases_generated']:3d} phrases | {r['cherokee_audio_min']:5.2f}m speech | {pipe_sec:5.1f}s ({speed:4.1f}x)")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
