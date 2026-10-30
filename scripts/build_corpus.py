#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/build_corpus.py

Builds static JSON bundles (`public/data/sources.json` and `public/data/phrases.json`)
for the Cherokee Phonetic Corpus Search & Audio Alignment Tool.

Uses the toneless Pre-Bible Cherokee ASR model:
  repo: charliemcvicker/length-only-20260704-155307-asr-cherokee-colon
  revision: 76e62140955f4738abdab345ea34068b02d8d2a2
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

# Ensure workshop-transcription is on sys.path
WORKSHOP_DIR = Path("/Users/julietmcvicker/code/workshop-transcription")
if str(WORKSHOP_DIR) not in sys.path:
    sys.path.insert(0, str(WORKSHOP_DIR))

from digohwelisgi.alignment.ctc_aligner import CTCSegmentationAligner
from digohwelisgi.alignment.ingestion import (
    normalize_phonetics_for_alignment,
    normalize_syllabary_for_alignment,
)
from digohwelisgi.alignment.models import CTCAlignerConfig
from digohwelisgi.cherokee.enrichment import align_character_syllable_detailed
from digohwelisgi.cherokee.models import CherokeeASRModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("build_corpus")

PRE_BIBLE_MODEL_REPO = "charliemcvicker/length-only-20260704-155307-asr-cherokee-colon"
PRE_BIBLE_MODEL_REVISION = "76e62140955f4738abdab345ea34068b02d8d2a2"

REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = REPO_ROOT / "public"
DATA_OUT_DIR = PUBLIC_DIR / "data"

SENTENCE_CSV_PATH = WORKSHOP_DIR / "data/training/processed/sentence_audio.csv"
SENTENCE_AUDIO_DIR = WORKSHOP_DIR / "data/training/processed/sentence_audio"
BIBLE_RECORDS_PATH = (
    WORKSHOP_DIR
    / "data/projects/cherokee_new_testament/alignments/bible_alignment_records.json"
)
BIBLE_SPLIT_AUDIO_DIR = (
    WORKSHOP_DIR / "data/projects/cherokee_new_testament/split_audio"
)
CTC_CACHE_DIR = WORKSHOP_DIR / ".cache/ctc_emissions"


def clean_to_canonical_tth(text: str) -> str:
    """
    Normalizes TTH phonetic text to lowercase canonical TTH.
    Strips tones, colons, hyphens, asterisks, and punctuation.
    Normalizes glottal stops to ASCII single quote (').
    Does NOT mutate t->th or k->kh (expects input already in TTH).
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFD", text)
    text = re.sub(r"[\u0300-\u036f]", "", text)
    text = re.sub(r"\d+", "", text)
    text = text.lower()
    text = re.sub(r"[’ʻʼʔ]", "'", text)
    text = re.sub(r"[*:\-ː.,?!;\"“”()‚]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_dg_to_canonical_tth(text: str) -> str:
    """
    Converts Durbin Feeling / D-G orthography into canonical lowercase TTH
    using digohwelisgi's normalize_phonetics_for_alignment.
    """
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFD", text).replace("*", "")
    tth = normalize_phonetics_for_alignment(
        decomposed,
        contextual_preaspiration=True,
    )
    return clean_to_canonical_tth(tth)


def create_broad_tth(canonical_tth: str) -> str:
    """Strips aspiration (h) and glottal stops (') for broad fallback indexing."""
    return canonical_tth.replace("h", "").replace("'", "")


def clean_syllabary(text: str) -> str:
    """
    Strips headword asterisks and syncope commas from syllabary display strings,
    and collapses the OCR-split ᎾᎿ Ꭽ -> ᎾᎿ.
    """
    if not text:
        return ""
    text = re.sub(r"ᎾᎿ\s*Ꭽ\s*", "ᎾᎿ ", text)
    text = re.sub(r"[*,‚]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def align_syllabary_tokens_to_words(
    syllabary_text: str, phonetic_words: Sequence[str]
) -> List[str]:
    """
    Ensures syllabary_text is partitioned into exactly len(phonetic_words) tokens
    corresponding 1:1 with phonetic_words.
    """
    syl_clean = clean_syllabary(syllabary_text)
    syl_tokens = syl_clean.split()
    if len(syl_tokens) == len(phonetic_words):
        return syl_tokens

    units = re.findall(
        r"[\u13A0-\u13FF\uAB70-\uABBF][^\u13A0-\u13FF\uAB70-\uABBF\s]*", syl_clean
    )
    if not units or not phonetic_words:
        return syl_tokens

    full_phon = " ".join(phonetic_words)
    word_bounds: List[Tuple[int, int]] = []
    pos = 0
    for w in phonetic_words:
        word_bounds.append((pos, pos + len(w)))
        pos += len(w) + 1

    pure_syl = "".join(u[0] for u in units)
    detailed = align_character_syllable_detailed(pure_syl, full_phon)

    out_words = ["" for _ in phonetic_words]
    for idx, item in enumerate(detailed):
        unit_str = units[idx] if idx < len(units) else item.syllabary_char
        mid = (item.emitted_start_idx + item.emitted_end_idx) / 2.0
        best_w = 0
        best_dist = float("inf")
        for w_i, (ws, we) in enumerate(word_bounds):
            if ws <= mid <= we:
                best_w = w_i
                break
            dist = min(abs(mid - ws), abs(mid - we))
            if dist < best_dist:
                best_dist = dist
                best_w = w_i
        out_words[best_w] += unit_str

    # Fallback if any slot remained empty (e.g. fewer syllabary chars than words)
    if any(not w for w in out_words):
        n_w = len(phonetic_words)
        n_u = len(units)
        out_words = []
        for i in range(n_w):
            start_u = int(round(i * n_u / n_w))
            end_u = max(start_u + 1, int(round((i + 1) * n_u / n_w)))
            chunk = "".join(units[start_u:end_u]) or (units[-1] if units else "—")
            out_words.append(chunk)

    return out_words


def build_dictionary_corpus(
    sources: List[Dict[str, Any]],
    phrases: List[Dict[str, Any]],
) -> None:
    """Ingests and aligns the 1975 Durbin Feeling Dictionary sentences."""
    logger.info("Loading Pre-Bible Cherokee ASR model: %s (%s)", PRE_BIBLE_MODEL_REPO, PRE_BIBLE_MODEL_REVISION)
    model = CherokeeASRModel.from_pretrained_or_best(
        path_or_repo=PRE_BIBLE_MODEL_REPO,
        revision=PRE_BIBLE_MODEL_REVISION,
    )
    config = CTCAlignerConfig(
        cache=True,
        cache_dir=CTC_CACHE_DIR,
    )
    aligner = CTCSegmentationAligner(model=model, config=config)

    sources.append(
        {
            "source_id": "dict_feeling_1975",
            "source_type": "dictionary_collection",
            "title": "Cherokee Dictionary Examples (1975 Feeling)",
            "sort_order": 1000,
        }
    )

    with open(SENTENCE_CSV_PATH, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    valid_rows: List[Dict[str, str]] = []
    for row in rows:
        sentence_id = (row.get("sentence_id") or "").strip()
        audio_filename = (row.get("audio") or "").strip()
        syl_raw = (row.get("syllabary") or "").strip()
        phon_raw = (row.get("phonetic") or "").strip()

        if not sentence_id or sentence_id == "6089d9d5aa62":
            continue
        if not audio_filename or not syl_raw or not phon_raw:
            continue
        wav_path = SENTENCE_AUDIO_DIR / audio_filename
        if not wav_path.exists():
            continue
        valid_rows.append(row)

    logger.info("Found %d valid dictionary sentences with audio on disk.", len(valid_rows))
    t0 = time.time()

    for idx, row in enumerate(valid_rows):
        sentence_id = row["sentence_id"].strip()
        audio_filename = row["audio"].strip()
        wav_path = SENTENCE_AUDIO_DIR / audio_filename

        syl_clean = clean_syllabary(row["syllabary"])
        syl_tokens = syl_clean.split()

        # Convert Feeling D/G phonetics to canonical TTH
        phon_tth = normalize_dg_to_canonical_tth(row["phonetic"])
        phon_tokens = phon_tth.split()

        # If Feeling phonetic word count differs from syllabary word count,
        # use syllabary-derived phonetic template so CTC segmentation produces
        # exact 1:1 tokens with the syllabary words!
        if len(phon_tokens) == len(syl_tokens):
            alignment_template = phon_tth
        else:
            alignment_template = clean_to_canonical_tth(
                normalize_syllabary_for_alignment(syl_clean)
            )

        lpz, dur_sec, _ = aligner.get_logits_cached(
            wav_path,
            asr_model=model,
            apply_buffers=True,
            cache=True,
        )
        aligned_chunk = aligner.align_verse_slice(
            audio_input=wav_path,
            chunk_id=sentence_id,
            phonetic_text=alignment_template,
            syllabary_text=syl_clean,
            asr_model=model,
            cache=True,
        )

        words_array: List[Dict[str, Any]] = []
        emitted_tokens: List[str] = []
        for w in aligned_chunk.words:
            ctc_tok = clean_to_canonical_tth(w.emitted_word or w.word) or clean_to_canonical_tth(w.word)
            emitted_tokens.append(ctc_tok)
            words_array.append(
                {
                    "word": ctc_tok,
                    "start": round(float(w.start_sec), 3),
                    "end": round(float(w.end_sec), 3),
                    "confidence": round(float(w.confidence), 4),
                    "flagged": bool(w.flagged),
                }
            )

        reconciled_syl_tokens = align_syllabary_tokens_to_words(syl_clean, emitted_tokens)
        canonical_tth = " ".join(emitted_tokens)
        final_syllabary = " ".join(reconciled_syl_tokens)

        assert len(words_array) == len(canonical_tth.split()) == len(final_syllabary.split()), (
            f"1:1 token mismatch in {sentence_id}: "
            f"words={len(words_array)}, phon={len(canonical_tth.split())}, syl={len(final_syllabary.split())}"
        )

        confs = [w["confidence"] for w in words_array]
        mean_conf = round(float(np.mean(confs)), 4) if confs else 0.0
        min_conf = round(float(np.min(confs)), 4) if confs else 0.0
        has_anomalies = any(w["flagged"] for w in words_array)

        match = re.search(r"entry_([0-9a-zA-Z_]+)\.", audio_filename)
        entry_label = f"Entry {match.group(1)}" if match else f"Entry {row['index']}"
        english_clean = clean_syllabary(row.get("english") or "") or None

        phrases.append(
            {
                "id": f"dict_ex_{sentence_id}",
                "source_id": "dict_feeling_1975",
                "loc_label": entry_label,
                "loc_index": int(row["index"]),
                "phonetic_text": canonical_tth,
                "phonetic_broad": create_broad_tth(canonical_tth),
                "syllabary_text": final_syllabary,
                "english_text": english_clean,
                "audio_path": f"sentence_audio/{audio_filename}",
                "audio_start": 0.0,
                "audio_end": round(float(dur_sec), 3),
                "mean_confidence": mean_conf,
                "min_confidence": min_conf,
                "has_anomalies": has_anomalies,
                "words": words_array,
            }
        )

        if (idx + 1) % 100 == 0 or (idx + 1) == len(valid_rows):
            elapsed = time.time() - t0
            logger.info(
                "Aligned %d/%d dictionary sentences (%.1fs elapsed, %.1f sent/s)",
                idx + 1,
                len(valid_rows),
                elapsed,
                (idx + 1) / max(0.001, elapsed),
            )


def build_bible_corpus(
    sources: List[Dict[str, Any]],
    phrases: List[Dict[str, Any]],
) -> None:
    """Ingests the 1,749 aligned Cherokee New Testament verses."""
    logger.info("Loading New Testament alignments from %s", BIBLE_RECORDS_PATH)
    with open(BIBLE_RECORDS_PATH, "r", encoding="utf-8") as f:
        bible_records = json.load(f)

    seen_chapters: set[str] = set()
    nt_count = 0

    for rec in bible_records:
        book = rec["book"].lower()
        book_code = book[:3]
        ch_num = int(rec["chapter"])
        v_num = int(rec["verse_idx"])
        source_id = f"nt_{book_code}_{ch_num:02d}"

        if source_id not in seen_chapters:
            seen_chapters.add(source_id)
            sort_base = 100 if book == "matthew" else 200
            sources.append(
                {
                    "source_id": source_id,
                    "source_type": "biblical_chapter",
                    "title": f"{book.capitalize()} {ch_num}",
                    "sort_order": sort_base + ch_num,
                }
            )

        verse_start_sec = float(rec.get("start_sec", 0.0))
        verse_end_sec = float(rec.get("end_sec", 0.0))
        clip_duration = round(max(0.0, verse_end_sec - verse_start_sec), 3)

        zero_offset_words: List[Dict[str, Any]] = []
        emitted_tokens: List[str] = []

        for w in rec.get("words", []):
            raw_ctc_tok = w.get("emitted_word") or w.get("word", "")
            ctc_tok = clean_to_canonical_tth(raw_ctc_tok) or clean_to_canonical_tth(
                w.get("word", "")
            )
            emitted_tokens.append(ctc_tok)
            w_start = round(max(0.0, float(w["start_sec"]) - verse_start_sec), 3)
            w_end = round(max(w_start, float(w["end_sec"]) - verse_start_sec), 3)
            w_conf = round(float(w.get("confidence", 1.0)), 4)
            w_flagged = bool(w.get("flagged", False))
            zero_offset_words.append(
                {
                    "word": ctc_tok,
                    "start": w_start,
                    "end": w_end,
                    "confidence": w_conf,
                    "flagged": w_flagged,
                }
            )

        reconciled_syl_tokens = align_syllabary_tokens_to_words(
            rec["cherokee_syllabary"], emitted_tokens
        )
        canonical_tth = " ".join(emitted_tokens)
        final_syllabary = " ".join(reconciled_syl_tokens)

        assert len(zero_offset_words) == len(canonical_tth.split()) == len(final_syllabary.split()), (
            f"1:1 token mismatch in {book} {ch_num}:{v_num}: "
            f"words={len(zero_offset_words)}, phon={len(canonical_tth.split())}, syl={len(final_syllabary.split())}"
        )

        confs = [w["confidence"] for w in zero_offset_words]
        mean_conf = round(float(np.mean(confs)), 4) if confs else 0.0
        min_conf = round(float(np.min(confs)), 4) if confs else 0.0
        has_anomalies = any(w["flagged"] for w in zero_offset_words)

        phrases.append(
            {
                "id": f"nt_{book_code}_{ch_num:02d}_{v_num:03d}",
                "source_id": source_id,
                "loc_label": f"{ch_num}:{v_num}",
                "loc_index": v_num,
                "phonetic_text": canonical_tth,
                "phonetic_broad": create_broad_tth(canonical_tth),
                "syllabary_text": final_syllabary,
                "english_text": (rec.get("english") or "").strip() or None,
                "audio_path": f"split_audio/{book}_{ch_num:02d}_{v_num:02d}.wav",
                "audio_start": 0.0,
                "audio_end": clip_duration,
                "mean_confidence": mean_conf,
                "min_confidence": min_conf,
                "has_anomalies": has_anomalies,
                "words": zero_offset_words,
            }
        )
        nt_count += 1

    logger.info("Ingested %d New Testament verses across %d chapters.", nt_count, len(seen_chapters))


def ensure_audio_symlinks() -> None:
    """Creates symlinks in public/ pointing to sentence_audio and split_audio."""
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    links = [
        (PUBLIC_DIR / "sentence_audio", SENTENCE_AUDIO_DIR),
        (PUBLIC_DIR / "split_audio", BIBLE_SPLIT_AUDIO_DIR),
    ]
    for link_path, target_path in links:
        if link_path.is_symlink() or link_path.exists():
            if link_path.is_symlink() and link_path.resolve() == target_path.resolve():
                continue
            link_path.unlink()
        os.symlink(str(target_path), str(link_path))
        logger.info("Linked %s -> %s", link_path, target_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Cherokee corpus JSON bundles.")
    parser.add_argument(
        "--include-nt",
        action="store_true",
        default=True,
        help="Include New Testament verses (default: True)",
    )
    parser.add_argument(
        "--dict-only",
        action="store_true",
        default=False,
        help="Only build Dictionary examples (Phase 1 only)",
    )
    args = parser.parse_args()

    ensure_audio_symlinks()
    DATA_OUT_DIR.mkdir(parents=True, exist_ok=True)

    sources: List[Dict[str, Any]] = []
    phrases: List[Dict[str, Any]] = []

    build_dictionary_corpus(sources, phrases)
    if args.include_nt and not args.dict_only:
        build_bible_corpus(sources, phrases)

    sources.sort(key=lambda s: s["sort_order"])

    sources_out = DATA_OUT_DIR / "sources.json"
    phrases_out = DATA_OUT_DIR / "phrases.json"

    with open(sources_out, "w", encoding="utf-8") as f:
        json.dump(sources, f, indent=2, ensure_ascii=False)

    with open(phrases_out, "w", encoding="utf-8") as f:
        json.dump(phrases, f, ensure_ascii=False)

    logger.info(
        "Wrote %d sources to %s and %d phrases to %s",
        len(sources),
        sources_out,
        len(phrases),
        phrases_out,
    )


if __name__ == "__main__":
    main()
