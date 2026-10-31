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
from digohwelisgi.cherokee.orthography.syllabary_map import (
    CHEROKEE_SYLLABARY_BASE_MAP as _RAW_SYLLABARY_BASE_MAP,
)

CHEROKEE_SYLLABARY_BASE_MAP: Dict[str, str] = dict(_RAW_SYLLABARY_BASE_MAP)
CHEROKEE_SYLLABARY_BASE_MAP["Ᏽ"] = "mv"
SYL_CHAR_CLASS = r"\u13A0-\u13FF\uAB70-\uABBF"
SYL_RE = re.compile(f"[{SYL_CHAR_CLASS}]")

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
STV_DIR = REPO_ROOT / "data/saving-the-voices"
STV_COLLECTION_JSON = STV_DIR / "saving-the-voices.json"
STV_TRANSCRIPTS_DIR = STV_DIR / "transcripts"
STV_SPLIT_AUDIO_DIR = STV_DIR / "split_audio"
STV_TURN_AUDIO_DIR = STV_DIR / "turn_audio"
STV_ALIGNMENTS_DIR = STV_DIR / "alignments"
KIWA_BASE_URL = "https://cherokee-language-hub.kiwadigital.com"


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
                "audio_path": f"sentence_audio/{Path(audio_filename).stem}.mp3",
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
                "audio_path": f"split_audio/{book}_{ch_num:02d}_{v_num:02d}.mp3",
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


def aspirate_syllable(phon: str) -> str:
    """Aspirates a syllable coda for an internal period (.) diacritic."""
    if not phon:
        return phon
    if not phon.endswith("h"):
        return phon + "h"
    return phon


def convert_marked_token(raw_tok: str) -> List[Tuple[str, str]]:
    """
    Pure transformation converting a raw whitespace token from a marked-up
    Saving the Voices transcript into a list of (clean_syllabary_display, canonical_tth)
    word pairs.

    Diacritic rules:
      - `,` = drop preceding vowel (syncope / apocope)
      - `;` = drop preceding vowel and add `h`
      - `.` = add `h` (coda aspiration without dropping vowel)
      - `:` = long vowel (strip `:`)
      - `’` / `'` = glottal stop `'` (internal or trailing; stripped when leading apheresis)
      - `-`, `--`, `...`, `…`, `/` = split stutter/repair/ellipsis into separate words,
        except English stem + hyphen + Syllabary clitic (e.g. `Bell-Ꭲ` -> `bell'i`).
      - Pure English words/stems are lowercased without D/G->T/TH consonant mutation.
      - Displayed syllabary token has all punctuation and diacritics stripped.
    """
    # 1. Strip inline timestamps like (16:58) or (18.13) and meta annotations
    tok = re.sub(r"\(\d+[:.]\d+\)", "", raw_tok)
    tok = re.sub(
        r"\((?:unintelligible|unclear|inaudible|laughs|laughter|cough|coughs|sighs|pause)\)",
        "",
        tok,
        flags=re.IGNORECASE,
    )
    tok = re.sub(
        r"\[(?:unintelligible|unclear|inaudible|laughs|laughter|cough|coughs|sighs|pause)\]",
        "",
        tok,
        flags=re.IGNORECASE,
    )

    # 2. Protect English-Syllabary compound clitic hyphens: e.g. Bell-Ꭲ, $120-Ꮫ, *outhouse*-Ꮽ, ᎠᏂ-Pettit
    tok = re.sub(
        f"([a-zA-Z0-9$*’'\"”])-([{SYL_CHAR_CLASS}])",
        "\\1\x00\\2",
        tok,
    )
    tok = re.sub(
        f"([{SYL_CHAR_CLASS}])-([a-zA-Z0-9$*‘'\"“])",
        "\\1\x00\\2",
        tok,
    )

    # 3. Split on stutter/repair/pause boundaries: --, —, –, ..., …, /, or remaining single hyphen -
    parts = re.split(r"--+|—|–|\.\.\.+|…+|/|-", tok)

    results: List[Tuple[str, str]] = []
    for part in parts:
        part = part.replace("\x00", "")
        if not part:
            continue

        # Remove parenthetical/bracketed wrappers around syllables while keeping content: ᏥᏛ(Ꭹ)ᏓᏁᎸ -> ᏥᏛᎩᏓᏁᎸ
        part = re.sub(r"[\(\)\[\]\"“”*]", "", part)
        if not part:
            continue

        has_syl = bool(SYL_RE.search(part))
        has_alpha = bool(re.search(r"[a-zA-Z0-9]", part))

        if not has_syl and not has_alpha:
            continue

        # Pure English/numeric token (no syllabary)
        if not has_syl:
            clean_en = re.sub(r"^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$", "", part)
            if not clean_en:
                continue
            tth_en = re.sub(r"[’ʻʼʔ]", "'", clean_en.lower())
            tth_en = re.sub(r"[^a-z0-9']", "", tth_en)
            if tth_en:
                results.append((clean_en, tth_en))
            continue

        # Token contains Cherokee syllabary (pure or code-switched compound clitic)
        # Strip leading non-alphanumeric, non-syllabary characters (like leading ‘ or ’ apheresis or quotes)
        part = re.sub(f"^[^a-zA-Z0-9{SYL_CHAR_CLASS}]+", "", part)
        if not part:
            continue

        # Strip trailing sentence-final . ? ! while preserving trailing , ; ’ '
        part = re.sub(r"[.?!]+$", "", part)

        syl_display_chars: List[str] = []
        phon_pieces: List[Tuple[str, str, bool]] = []  # (type, phon, had_vowel_drop)

        i = 0
        n = len(part)
        while i < n:
            ch = part[i]
            if SYL_RE.match(ch):
                ch_upper = ch.upper()
                syl_display_chars.append(ch_upper)
                base_phon = CHEROKEE_SYLLABARY_BASE_MAP.get(ch_upper, ch_upper)
                j = i + 1
                diacritics: List[str] = []
                while j < n and not SYL_RE.match(part[j]) and not part[j].isalnum():
                    diacritics.append(part[j])
                    j += 1

                has_comma = "," in diacritics or "‚" in diacritics
                has_semi = ";" in diacritics
                has_dot = "." in diacritics
                has_apo = any(d in ("’", "'", "‘", "ʼ", "ʻ") for d in diacritics)

                if has_semi:
                    if base_phon and base_phon[-1] in "aeiouv":
                        base_phon = base_phon[:-1] + "h"
                    elif not base_phon.endswith("h"):
                        base_phon = base_phon + "h"
                elif has_comma:
                    if base_phon and base_phon[-1] in "aeiouv" and len(base_phon) > 1:
                        base_phon = base_phon[:-1]

                if has_dot:
                    base_phon = aspirate_syllable(base_phon)

                if has_apo:
                    base_phon = base_phon + "'"

                phon_pieces.append(("syl", base_phon, has_comma or has_semi))
                i = j
            elif ch.isalnum():
                j = i
                while (
                    j < n
                    and not SYL_RE.match(part[j])
                    and (
                        part[j].isalnum()
                        or (
                            part[j] in ("’", "'")
                            and j + 1 < n
                            and part[j + 1].isalpha()
                            and not SYL_RE.match(part[j + 1])
                        )
                    )
                ):
                    j += 1
                en_chunk = part[i:j]
                syl_display_chars.append(en_chunk)
                en_clean = en_chunk.lower().replace("’", "'")
                while j < n and not SYL_RE.match(part[j]) and not part[j].isalnum():
                    j += 1
                phon_pieces.append(("en", en_clean, False))
                i = j
            else:
                i += 1

        syl_disp = "".join(syl_display_chars)
        if not syl_disp:
            continue

        combined = ""
        for idx_p, (ptype, pval, _had_drop) in enumerate(phon_pieces):
            if ptype == "syl":
                if idx_p > 0 and phon_pieces[idx_p - 1][0] == "en":
                    if pval and pval[0] in "aeiouv" and not combined.endswith("'"):
                        combined += "'" + pval
                    else:
                        combined += pval
                else:
                    if (
                        idx_p > 0
                        and phon_pieces[idx_p - 1][0] == "syl"
                        and not phon_pieces[idx_p - 1][2]
                        and combined
                        and combined[-1] in "aeiouv"
                        and pval.startswith("s")
                    ):
                        combined += "h" + pval
                    elif (
                        idx_p > 0
                        and phon_pieces[idx_p - 1][0] == "syl"
                        and combined
                        and combined[-1] in "aeiouv"
                        and pval
                        and pval[0] in "aeiouv"
                    ):
                        combined += "'" + pval
                    else:
                        combined += pval
            else:
                combined += pval

        # Collapse duplicate h and duplicate '
        combined = re.sub(r"h+", "h", combined)
        combined = re.sub(r"'+", "'", combined)
        if combined:
            results.append((syl_disp, combined))

    return results


def convert_marked_segment(raw_text: str) -> Tuple[str, str, List[str]]:
    """
    Converts a full Saving the Voices segment.text string into:
      (syllabary_text, phonetic_text, phonetic_words)
    where len(syllabary_text.split()) == len(phonetic_text.split()) == len(phonetic_words).
    """
    text = re.sub(r"ᎾᎿ\s*Ꭽ\s*", "ᎾᎿ ", raw_text)
    syl_words: List[str] = []
    phon_words: List[str] = []
    for raw_tok in text.split():
        for s_w, p_w in convert_marked_token(raw_tok):
            if s_w and p_w:
                syl_words.append(s_w)
                phon_words.append(p_w)
    return " ".join(syl_words), " ".join(phon_words), phon_words


def _format_mm_ss(seconds: float) -> str:
    total_sec = max(0, int(round(seconds)))
    mins, secs = divmod(total_sec, 60)
    return f"{mins}:{secs:02d}"


def _format_speaker_name(speaker_slug: str) -> str:
    if not speaker_slug:
        return ""
    return " ".join(part.capitalize() for part in speaker_slug.replace("_", "-").split("-") if part)


def build_saving_the_voices_corpus(
    sources: List[Dict[str, Any]],
    phrases: List[Dict[str, Any]],
) -> None:
    """
    Ingests the 22 Saving the Voices interviews that have both Cherokee syllabary text
    and startMs/endMs audio timestamps, linking directly to the remote Kiwa Digital MP3 URLs.
    """
    if not STV_COLLECTION_JSON.exists():
        logger.warning("Saving the Voices collection JSON not found at %s; skipping.", STV_COLLECTION_JSON)
        return

    with open(STV_COLLECTION_JSON, "r", encoding="utf-8") as f:
        collection_data = json.load(f)

    assets = collection_data.get("assets", [])
    stv_sources_count = 0
    stv_phrases_count = 0

    for asset in assets:
        transcript_rel_url = asset.get("transcriptUrl")
        if not transcript_rel_url:
            continue

        transcript_filename = Path(transcript_rel_url).name
        transcript_path = STV_TRANSCRIPTS_DIR / transcript_filename
        if not transcript_path.exists():
            continue

        with open(transcript_path, "r", encoding="utf-8") as f:
            t_data = json.load(f)

        segments = t_data.get("segments", [])
        has_syl = any(SYL_RE.search(s.get("text") or "") for s in segments)
        has_time = any(
            s.get("startMs") is not None and s.get("endMs") is not None
            for s in segments
        )
        if not (has_syl and has_time):
            continue

        asset_id: str = asset.get("id", transcript_path.stem)
        # Extract numeric index from asset_id (e.g. saving-the-voices-0001-toney-cornshucker -> 1)
        num_match = re.search(r"saving-the-voices-(\d+)-(.+)", asset_id)
        if num_match:
            interview_num = int(num_match.group(1))
            slug_rest = num_match.group(2).replace("-", "_")
            source_id = f"stv_{interview_num:04d}_{slug_rest}"
        else:
            interview_num = stv_sources_count + 1
            source_id = f"stv_{asset_id.replace('-', '_')}"

        title_en = (asset.get("title") or asset_id).strip()
        title_syl = (asset.get("titleSyllabary") or "").strip()
        display_title = (
            f"Saving the Voices: {title_en} ({title_syl})"
            if title_syl
            else f"Saving the Voices: {title_en}"
        )

        media_rel_url = (asset.get("url") or "").strip()
        remote_audio_url = (
            f"{KIWA_BASE_URL}{media_rel_url}"
            if media_rel_url.startswith("/")
            else media_rel_url
        )

        aligned_manifest_file = STV_ALIGNMENTS_DIR / f"{source_id}_aligned.json"
        if aligned_manifest_file.exists():
            with open(aligned_manifest_file, "r", encoding="utf-8") as f:
                aligned_data = json.load(f)
            sources.append(
                {
                    "source_id": source_id,
                    "source_type": "marked_syllabary_corpus",
                    "title": display_title,
                    "sort_order": 2000 + interview_num,
                }
            )
            stv_sources_count += 1
            seg_speaker_map: Dict[str, str] = {}
            for idx_s, s_obj in enumerate(segments, start=1):
                s_id = str(s_obj.get("id") or f"seg-{idx_s:03d}")
                sp_lbl = (
                    (s_obj.get("speakerLabel") or "").strip()
                    or _format_speaker_name(str(s_obj.get("speaker") or ""))
                )
                if sp_lbl:
                    seg_speaker_map[s_id] = sp_lbl

            raw_phrases = aligned_data.get("phrases", [])
            turn_counts: Dict[str, int] = {}
            for p in raw_phrases:
                t_id = str(p.get("turn_id") or "")
                turn_counts[t_id] = turn_counts.get(t_id, 0) + 1

            for p in raw_phrases:
                t_id = str(p.get("turn_id") or "")
                turn_num_match = re.search(r"(\d+)", t_id)
                turn_num_int = int(turn_num_match.group(1)) if turn_num_match else 1
                turn_clean = f"{turn_num_int:03d}"
                speaker_lbl = seg_speaker_map.get(t_id) or title_en
                t_total = turn_counts.get(t_id, 1)
                turn_wav_disk = STV_TURN_AUDIO_DIR / source_id / f"{t_id}.wav"
                turn_audio_rel = (
                    f"stv_turn_audio/{source_id}/{t_id}.mp3"
                    if turn_wav_disk.exists()
                    else None
                )
                phrases.append(
                    {
                        "id": p["phrase_id"],
                        "source_id": source_id,
                        "loc_label": f"Seg {turn_clean}.{p['phrase_index']} ({_format_mm_ss(p['global_start_sec'])}) • {speaker_lbl}",
                        "loc_index": turn_num_int * 100 + p["phrase_index"],
                        "turn_id": t_id,
                        "phrase_index": p["phrase_index"],
                        "turn_phrase_count": t_total,
                        "speaker_label": speaker_lbl,
                        "turn_audio_path": turn_audio_rel,
                        "turn_start_sec": p.get("turn_start_sec"),
                        "turn_end_sec": p.get("turn_end_sec"),
                        "global_start_sec": p.get("global_start_sec"),
                        "global_end_sec": p.get("global_end_sec"),
                        "phonetic_text": p["phonetic_text"],
                        "phonetic_broad": p["phonetic_broad"],
                        "syllabary_text": p["syllabary_text"],
                        "english_text": p.get("english_text"),
                        "audio_path": p["wav_rel_path"].replace(".wav", ".mp3"),
                        "audio_start": 0.0,
                        "audio_end": p["duration_sec"],
                        "mean_confidence": p["mean_confidence"],
                        "min_confidence": p["min_confidence"],
                        "has_anomalies": p["has_anomalies"],
                        "words": p["words"],
                    }
                )
                stv_phrases_count += 1
            logger.info("Ingested %d locally aligned phrases for %s", len(raw_phrases), source_id)
            continue

        added_source = False
        for seg_idx, seg in enumerate(segments, start=1):
            raw_text = (seg.get("text") or "").strip()
            if not raw_text or not SYL_RE.search(raw_text):
                continue
            start_ms = seg.get("startMs")
            end_ms = seg.get("endMs")
            if start_ms is None or end_ms is None:
                continue

            syl_text, phon_text, phon_words = convert_marked_segment(raw_text)
            if not phon_words:
                continue

            assert len(syl_text.split()) == len(phon_text.split()) == len(phon_words), (
                f"1:1 token mismatch in {asset_id} {seg.get('id')}: "
                f"syl={len(syl_text.split())}, phon={len(phon_text.split())}"
            )

            if not added_source:
                sources.append(
                    {
                        "source_id": source_id,
                        "source_type": "marked_syllabary_corpus",
                        "title": display_title,
                        "sort_order": 2000 + interview_num,
                    }
                )
                added_source = True
                stv_sources_count += 1

            start_sec = round(max(0.0, float(start_ms) / 1000.0), 3)
            end_sec = round(max(start_sec, float(end_ms) / 1000.0), 3)

            seg_id_raw = str(seg.get("id") or f"seg-{seg_idx:03d}")
            seg_num_match = re.search(r"(\d+)", seg_id_raw)
            seg_num = int(seg_num_match.group(1)) if seg_num_match else seg_idx

            speaker_label = (
                (seg.get("speakerLabel") or "").strip()
                or _format_speaker_name(str(seg.get("speaker") or ""))
            )
            time_str = _format_mm_ss(start_sec)
            loc_label = (
                f"Seg {seg_num:03d} ({time_str}) • {speaker_label}"
                if speaker_label
                else f"Seg {seg_num:03d} ({time_str})"
            )

            words_array: List[Dict[str, Any]] = [
                {
                    "word": w_tok,
                    "start": start_sec,
                    "end": end_sec,
                    "confidence": 1.0,
                    "flagged": False,
                }
                for w_tok in phon_words
            ]

            english_clean = (seg.get("translation") or "").strip() or None

            phrases.append(
                {
                    "id": f"{source_id}_seg_{seg_num:04d}",
                    "source_id": source_id,
                    "loc_label": loc_label,
                    "loc_index": seg_num,
                    "turn_id": seg_id_raw,
                    "phrase_index": 1,
                    "turn_phrase_count": 1,
                    "speaker_label": speaker_label or title_en,
                    "turn_start_sec": start_sec,
                    "turn_end_sec": end_sec,
                    "global_start_sec": start_sec,
                    "global_end_sec": end_sec,
                    "phonetic_text": phon_text,
                    "phonetic_broad": create_broad_tth(phon_text),
                    "syllabary_text": syl_text,
                    "english_text": english_clean,
                    "audio_path": remote_audio_url,
                    "audio_start": start_sec,
                    "audio_end": end_sec,
                    "mean_confidence": 1.0,
                    "min_confidence": 1.0,
                    "has_anomalies": False,
                    "words": words_array,
                }
            )
            stv_phrases_count += 1

    logger.info(
        "Ingested %d Saving the Voices segments across %d interviews.",
        stv_phrases_count,
        stv_sources_count,
    )


def ensure_audio_symlinks() -> None:
    """Creates symlinks in public/ pointing to sentence_audio, split_audio, stv_audio, and stv_turn_audio."""
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    STV_SPLIT_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    STV_TURN_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    links = [
        (PUBLIC_DIR / "sentence_audio", SENTENCE_AUDIO_DIR),
        (PUBLIC_DIR / "split_audio", BIBLE_SPLIT_AUDIO_DIR),
        (PUBLIC_DIR / "stv_audio", STV_SPLIT_AUDIO_DIR),
        (PUBLIC_DIR / "stv_turn_audio", STV_TURN_AUDIO_DIR),
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
        "--include-stv",
        action="store_true",
        default=True,
        help="Include Saving the Voices interviews (default: True)",
    )
    parser.add_argument(
        "--dict-only",
        action="store_true",
        default=False,
        help="Only build Dictionary examples (Phase 1 only)",
    )
    parser.add_argument(
        "--reuse-existing-dict-nt",
        action="store_true",
        default=False,
        help="Reuse existing Dictionary and New Testament records from public/data/ if present",
    )
    args = parser.parse_args()

    ensure_audio_symlinks()
    DATA_OUT_DIR.mkdir(parents=True, exist_ok=True)

    sources: List[Dict[str, Any]] = []
    phrases: List[Dict[str, Any]] = []

    sources_out = DATA_OUT_DIR / "sources.json"
    phrases_out = DATA_OUT_DIR / "phrases.json"

    if args.reuse_existing_dict_nt and sources_out.exists() and phrases_out.exists():
        logger.info("Reusing existing Dictionary & NT records from %s", DATA_OUT_DIR)
        with open(sources_out, "r", encoding="utf-8") as f:
            existing_sources = json.load(f)
        with open(phrases_out, "r", encoding="utf-8") as f:
            existing_phrases = json.load(f)
        kept_source_ids = {
            s["source_id"]
            for s in existing_sources
            if s.get("source_type") in ("dictionary_collection", "biblical_chapter")
        }
        sources.extend(s for s in existing_sources if s["source_id"] in kept_source_ids)
        phrases.extend(p for p in existing_phrases if p["source_id"] in kept_source_ids)
    else:
        build_dictionary_corpus(sources, phrases)
        if args.include_nt and not args.dict_only:
            build_bible_corpus(sources, phrases)

    if args.include_stv and not args.dict_only:
        build_saving_the_voices_corpus(sources, phrases)

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
