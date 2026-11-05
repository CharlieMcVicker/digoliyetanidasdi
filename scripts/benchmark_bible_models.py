#!/usr/bin/env python3
"""
scripts/benchmark_bible_models.py

Benchmarks checkpoint-7600 and checkpoint-8000 against baseline on all 1,749 verses
(23,035 words) of the Cherokee New Testament (Matthew & Mark), explicitly isolating:
1. Seen (Training Split): 479 verses (5,273 words) present in bible-wav2vec2-train.csv
2. Unseen (Held-Out Test Split): 1,270 verses (17,762 words) never seen during training
3. Combined (Full NT Corpus): 1,749 verses (23,035 words)

Outputs:
- data/benchmarks/bible/checkpoint_7600_results.json
- data/benchmarks/bible/checkpoint_8000_results.json
- <artifact_dir>/bible_model_comparison_dashboard.png
- <artifact_dir>/bible_models_comparison_summary.json
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch

matplotlib.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial', 'Noto Sans Cherokee', 'Plantagenet Cherokee']
matplotlib.rcParams['font.family'] = 'sans-serif'

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKSHOP_DIR = Path("/Users/julietmcvicker/code/workshop-transcription")
if str(WORKSHOP_DIR) not in sys.path:
    sys.path.insert(0, str(WORKSHOP_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from digohwelisgi.alignment.ctc_aligner import CTCSegmentationAligner
from digohwelisgi.cherokee.models.loader import CherokeeASRModel
from digohwelisgi.cherokee.phonotactics import create_cherokee_ctc_config
from digohwelisgi.pipelines.scripture import default_scripture_phonetic_normalizer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("benchmark_bible")

ARTIFACT_DIR = Path("/Users/julietmcvicker/.gemini/antigravity-cli/brain/6349a8b6-0ba2-4394-847c-f3a74cb51acc")
BENCHMARKS_DIR = REPO_ROOT / "data" / "benchmarks" / "bible"

BIBLE_RECORDS_PATH = (
    WORKSHOP_DIR
    / "data"
    / "projects"
    / "cherokee_new_testament"
    / "alignments"
    / "bible_alignment_records.json"
)
SPLIT_AUDIO_DIR = (
    WORKSHOP_DIR
    / "data"
    / "projects"
    / "cherokee_new_testament"
    / "split_audio"
)
TRAIN_CSV_PATH = (
    WORKSHOP_DIR
    / "data"
    / "training"
    / "processed"
    / "bible-wav2vec2-train.csv"
)
VALID_CSV_PATH = (
    WORKSHOP_DIR
    / "data"
    / "training"
    / "processed"
    / "bible-wav2vec2-valid.csv"
)
TEST_CSV_PATH = (
    WORKSHOP_DIR
    / "data"
    / "training"
    / "processed"
    / "bible-wav2vec2-test.csv"
)

MODELS = {
    "baseline": {
        "repo": "charliemcvicker/length-only-20260704-155307-asr-cherokee-colon",
        "label": "Baseline Model",
        "color": "#6c757d",
    },
    "checkpoint-7600": {
        "repo": "charliemcvicker/bible-augmentation-20261103-214935-wav2vec2-large-xlsr",
        "label": "Checkpoint-7600 (Conversational & Bible)",
        "color": "#1f77b4",
    },
    "checkpoint-8000": {
        "repo": "charliemcvicker/bible-augmentation-checkpoint-8000-wav2vec2-large-xlsr",
        "label": "Checkpoint-8000 (Bible Specialist)",
        "color": "#2ca02c",
    },
}


def load_hf_token() -> Optional[str]:
    token_path = Path.home() / ".cache" / "huggingface" / "token"
    if token_path.exists():
        return token_path.read_text().strip()
    return os.environ.get("HF_TOKEN")


def load_seen_and_unseen_stems() -> Tuple[Set[str], Set[str], Set[str]]:
    """Loads stem sets for train (seen), valid, test."""
    train_stems: Set[str] = set()
    valid_stems: Set[str] = set()
    test_stems: Set[str] = set()

    if TRAIN_CSV_PATH.exists():
        df_train = pd.read_csv(TRAIN_CSV_PATH)
        train_stems = set(Path(p).stem for p in df_train["path"])
    if VALID_CSV_PATH.exists():
        df_valid = pd.read_csv(VALID_CSV_PATH)
        valid_stems = set(Path(p).stem for p in df_valid["path"])
    if TEST_CSV_PATH.exists():
        df_test = pd.read_csv(TEST_CSV_PATH)
        test_stems = set(Path(p).stem for p in df_test["path"])

    logger.info(
        "Loaded training splits: %d train (seen), %d valid, %d test stems",
        len(train_stems),
        len(valid_stems),
        len(test_stems),
    )
    return train_stems, valid_stems, test_stems


def load_baseline_records() -> List[Dict[str, Any]]:
    with open(BIBLE_RECORDS_PATH, "r", encoding="utf-8") as f:
        records = json.load(f)
    logger.info("Loaded %d baseline Bible records", len(records))
    return records


def evaluate_bible_model(
    model_key: str,
    repo: str,
    baseline_records: List[Dict[str, Any]],
    token: Optional[str],
    device: str = "mps",
    force_rescore: bool = False,
    max_verses: Optional[int] = None,
    model: Optional[CherokeeASRModel] = None,
    aligner: Optional[CTCSegmentationAligner] = None,
) -> List[Dict[str, Any]]:
    """Evaluates all Bible verses under the specified model, caching output."""
    cache_file = BENCHMARKS_DIR / f"{model_key.replace('-', '_')}_results.json"
    if not force_rescore and cache_file.exists():
        logger.info("Found cached results for %s at %s. Loading...", model_key, cache_file)
        with open(cache_file, "r", encoding="utf-8") as f:
            cached_records = json.load(f)
        if len(cached_records) == len(baseline_records):
            logger.info("Loaded %d cached verse results for %s", len(cached_records), model_key)
            return cached_records

    BENCHMARKS_DIR.mkdir(parents=True, exist_ok=True)

    if model is None or aligner is None:
        logger.info("Loading %s on %s...", repo, device)
        model = CherokeeASRModel.from_pretrained_or_best(
            path_or_repo=repo,
            token=token,
            device=device,
        )
        cfg = create_cherokee_ctc_config(
            flag_min_char_confidence=0.0,
            cache=True,
            cache_dir=BENCHMARKS_DIR / f".cache_{model_key.replace('-', '_')}",
        )
        aligner = CTCSegmentationAligner(model=model, config=cfg)

    results: List[Dict[str, Any]] = []
    target_records = baseline_records[:max_verses] if max_verses else baseline_records
    total = len(target_records)
    logger.info("Starting realignment of %d verses for %s...", total, model_key)

    t_start = time.time()
    for idx, base_rec in enumerate(target_records):
        verse_id = base_rec["verse_id"]
        stem = Path(base_rec["audio_path"]).stem
        wav_path = SPLIT_AUDIO_DIR / f"{stem}.wav"

        if not wav_path.exists():
            logger.warning("Wav file %s not found; skipping", wav_path)
            continue

        phonetic_raw = base_rec.get("phonetic", "")
        norm_phonetic = default_scripture_phonetic_normalizer(phonetic_raw)
        syllabary = base_rec.get("reference_sentence", "")

        t0 = time.time()
        aligned = aligner.align_verse_slice(
            audio_input=wav_path,
            chunk_id=verse_id,
            phonetic_text=norm_phonetic,
            syllabary_text=syllabary,
        )
        elapsed = time.time() - t0

        words_data = [
            {
                "word": w.word,
                "confidence": float(w.confidence) if w.confidence is not None else 0.0,
                "start_sec": round(float(w.start_sec), 3) if w.start_sec is not None else 0.0,
                "end_sec": round(float(w.end_sec), 3) if w.end_sec is not None else 0.0,
                "emitted_word": w.emitted_word or "",
                "flagged": bool(w.flagged),
            }
            for w in (aligned.words or [])
        ]
        confs = [w["confidence"] for w in words_data]
        mean_conf = float(np.mean(confs)) if confs else 0.0

        res_record = {
            "verse_id": verse_id,
            "book": base_rec.get("book", ""),
            "chapter": base_rec.get("chapter", 0),
            "verse_idx": base_rec.get("verse_idx", 0),
            "audio_stem": stem,
            "words": words_data,
            "mean_confidence": round(mean_conf, 4),
            "emitted_text": (aligned.emitted_text or "").strip(),
            "time_sec": round(elapsed, 4),
        }
        results.append(res_record)

        if (idx + 1) % 100 == 0 or (idx + 1) == total:
            rate = (idx + 1) / (time.time() - t_start)
            logger.info("  [%4d/%4d] Realigned (%4.1f verses/sec)...", idx + 1, total, rate)

    total_time = time.time() - t_start
    logger.info("Completed %d verses for %s in %.2fs (%.2f verses/sec)", total, model_key, total_time, total / total_time)

    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    logger.info("Saved cache to %s", cache_file)

    return results


def compute_split_metrics(
    baseline_records: List[Dict[str, Any]],
    model_records: List[Dict[str, Any]],
    filter_stems: Optional[Set[str]] = None,
    is_seen_filter: Optional[bool] = None,
    seen_stems: Optional[Set[str]] = None,
) -> Dict[str, Any]:
    """Computes comprehensive metrics for a given subset (Unseen, Seen, or All)."""
    base_by_id = {r["verse_id"]: r for r in baseline_records}
    model_by_id = {r["verse_id"]: r for r in model_records}

    word_confs: List[float] = []
    base_word_confs: List[float] = []
    verse_confs: List[float] = []
    base_verse_confs: List[float] = []
    paired_deltas: List[float] = []

    included_verses = 0

    for vid, m_rec in model_by_id.items():
        stem = m_rec["audio_stem"]
        if is_seen_filter is not None and seen_stems is not None:
            if is_seen_filter and stem not in seen_stems:
                continue
            if not is_seen_filter and stem in seen_stems:
                continue
        elif filter_stems is not None and stem not in filter_stems:
            continue

        b_rec = base_by_id.get(vid)
        if not b_rec:
            continue

        included_verses += 1
        m_words = m_rec.get("words", [])
        b_words = b_rec.get("words", [])

        # Word level
        for mw in m_words:
            c = mw["confidence"]
            word_confs.append(c)

        for bw in b_words:
            c = bw["confidence"]
            base_word_confs.append(c)

        # Paired delta
        min_len = min(len(m_words), len(b_words))
        for i in range(min_len):
            delta = m_words[i]["confidence"] - b_words[i]["confidence"]
            paired_deltas.append(delta)

        # Verse level
        m_v_conf = m_rec.get("mean_confidence", np.mean([w["confidence"] for w in m_words]) if m_words else 0.0)
        b_v_conf = b_rec.get("greedy_confidence", np.mean([w["confidence"] for w in b_words]) if b_words else 0.0)
        verse_confs.append(m_v_conf)
        base_verse_confs.append(b_v_conf)

    w_arr = np.array(word_confs) if word_confs else np.array([0.0])
    b_w_arr = np.array(base_word_confs) if base_word_confs else np.array([0.0])
    v_arr = np.array(verse_confs) if verse_confs else np.array([0.0])
    b_v_arr = np.array(base_verse_confs) if base_verse_confs else np.array([0.0])
    d_arr = np.array(paired_deltas) if paired_deltas else np.array([0.0])

    # Quality tiers
    high_pct = float(np.mean(w_arr >= 0.80) * 100)
    med_pct = float(np.mean((w_arr >= 0.50) & (w_arr < 0.80)) * 100)
    low_pct = float(np.mean((w_arr >= 0.05) & (w_arr < 0.50)) * 100)
    fail_pct = float(np.mean(w_arr < 0.05) * 100)

    # Base quality tiers
    b_high_pct = float(np.mean(b_w_arr >= 0.80) * 100)
    b_med_pct = float(np.mean((b_w_arr >= 0.50) & (b_w_arr < 0.80)) * 100)
    b_low_pct = float(np.mean((b_w_arr >= 0.05) & (b_w_arr < 0.50)) * 100)
    b_fail_pct = float(np.mean(b_w_arr < 0.05) * 100)

    # Paired win/tie/loss
    wins = float(np.mean(d_arr > 0.02) * 100)
    ties = float(np.mean(np.abs(d_arr) <= 0.02) * 100)
    losses = float(np.mean(d_arr < -0.02) * 100)

    return {
        "verses_count": included_verses,
        "words_count": len(w_arr),
        "word_level": {
            "mean": float(np.mean(w_arr)),
            "std": float(np.std(w_arr)),
            "median": float(np.median(w_arr)),
            "q25": float(np.percentile(w_arr, 25)),
            "q75": float(np.percentile(w_arr, 75)),
            "iqr": float(np.percentile(w_arr, 75) - np.percentile(w_arr, 25)),
            "p10": float(np.percentile(w_arr, 10)),
            "p90": float(np.percentile(w_arr, 90)),
        },
        "baseline_word_level": {
            "mean": float(np.mean(b_w_arr)),
            "std": float(np.std(b_w_arr)),
            "median": float(np.median(b_w_arr)),
            "q25": float(np.percentile(b_w_arr, 25)),
            "q75": float(np.percentile(b_w_arr, 75)),
            "iqr": float(np.percentile(b_w_arr, 75) - np.percentile(b_w_arr, 25)),
            "p10": float(np.percentile(b_w_arr, 10)),
            "p90": float(np.percentile(b_w_arr, 90)),
        },
        "verse_level": {
            "mean": float(np.mean(v_arr)),
            "std": float(np.std(v_arr)),
            "median": float(np.median(v_arr)),
            "iqr": float(np.percentile(v_arr, 75) - np.percentile(v_arr, 25)),
        },
        "baseline_verse_level": {
            "mean": float(np.mean(b_v_arr)),
            "std": float(np.std(b_v_arr)),
            "median": float(np.median(b_v_arr)),
            "iqr": float(np.percentile(b_v_arr, 75) - np.percentile(b_v_arr, 25)),
        },
        "quality_tiers": {
            "high_ge_080": high_pct,
            "medium_050_080": med_pct,
            "low_005_050": low_pct,
            "failing_lt_005": fail_pct,
        },
        "baseline_quality_tiers": {
            "high_ge_080": b_high_pct,
            "medium_050_080": b_med_pct,
            "low_005_050": b_low_pct,
            "failing_lt_005": b_fail_pct,
        },
        "paired_shift": {
            "mean_delta": float(np.mean(d_arr)),
            "median_delta": float(np.median(d_arr)),
            "win_rate_pct": wins,
            "tie_rate_pct": ties,
            "loss_rate_pct": losses,
        },
        "raw_word_confs": word_confs,
        "raw_base_word_confs": base_word_confs,
        "raw_deltas": paired_deltas,
    }


def plot_bible_dashboard(
    metrics_by_model: Dict[str, Dict[str, Dict[str, Any]]],
    output_path: Path,
) -> None:
    """
    Creates a 4-panel dashboard:
    Panel 1: Word Confidence Distributions (Unseen Test vs Seen Train) across Models
    Panel 2: Quality Tier Stacked Bar Chart for Unseen (Held-out) vs Seen (Train)
    Panel 3: Paired Delta Shifts (Win/Tie/Loss) on Held-out Unseen Verses
    Panel 4: Generalization Gap: Delta on Seen vs Unseen (Detecting Overfitting vs Robust Generalization)
    """
    fig, axes = plt.subplots(2, 2, figsize=(18, 12), dpi=300)
    plt.subplots_adjust(hspace=0.35, wspace=0.25)

    models_order = ["baseline", "checkpoint-7600", "checkpoint-8000"]
    model_colors = [MODELS[m]["color"] for m in models_order]
    short_labels = ["Baseline", "Chkpt-7600", "Chkpt-8000"]

    # ----------------------------------------------------
    # Panel 1: Confidence Distributions by Split (Boxplots)
    # ----------------------------------------------------
    ax1 = axes[0, 0]
    positions = []
    box_data = []
    box_colors = []
    tick_labels = []

    pos = 1
    for m_idx, m_key in enumerate(models_order):
        # Unseen
        if m_key == "baseline":
            unseen_raw = metrics_by_model["checkpoint-7600"]["unseen"]["raw_base_word_confs"]
            seen_raw = metrics_by_model["checkpoint-7600"]["seen"]["raw_base_word_confs"]
        else:
            unseen_raw = metrics_by_model[m_key]["unseen"]["raw_word_confs"]
            seen_raw = metrics_by_model[m_key]["seen"]["raw_word_confs"]

        # Sample for plotting speed if large
        unseen_sample = np.random.choice(unseen_raw, size=min(4000, len(unseen_raw)), replace=False)
        seen_sample = np.random.choice(seen_raw, size=min(4000, len(seen_raw)), replace=False)

        box_data.extend([unseen_sample, seen_sample])
        positions.extend([pos, pos + 1])
        box_colors.extend([model_colors[m_idx], model_colors[m_idx]])
        tick_labels.extend([f"{short_labels[m_idx]}\nUnseen", f"{short_labels[m_idx]}\nSeen (Train)"])
        pos += 2.8

    bplot = ax1.boxplot(
        box_data,
        positions=positions,
        widths=0.7,
        patch_artist=True,
        showmeans=True,
        meanprops={"marker": "^", "markerfacecolor": "yellow", "markeredgecolor": "black", "markersize": 7},
        medianprops={"color": "white", "linewidth": 2},
        flierprops={"marker": ".", "markersize": 2, "alpha": 0.2},
    )
    for patch, c in zip(bplot["boxes"], box_colors):
        patch.set_facecolor(c)
        patch.set_alpha(0.8)

    ax1.set_xticks(positions)
    ax1.set_xticklabels(tick_labels, fontsize=8.5)
    ax1.set_ylabel("Word Alignment Confidence", fontsize=11, fontweight="bold")
    ax1.set_ylim(-0.05, 1.05)
    ax1.set_title("1. Confidence Distributions: Unseen Test vs. Seen Train\n(Yellow Δ = Mean, White line = Median)", fontsize=12, fontweight="bold")
    ax1.grid(True, linestyle="--", alpha=0.3, axis="y")

    # ----------------------------------------------------
    # Panel 2: Quality Tiers (Stacked Bar)
    # ----------------------------------------------------
    ax2 = axes[0, 1]
    tier_labels = ["High (≥0.80)", "Med [0.50, 0.80)", "Low [0.05, 0.50)", "Failing (<0.05)"]
    tier_colors = ["#2ca02c", "#ff7f0e", "#d62728", "#7f7f7f"]

    # 6 columns: Baseline Unseen, 7600 Unseen, 8000 Unseen, Baseline Seen, 7600 Seen, 8000 Seen
    col_names = [
        "Base\nUnseen", "7600\nUnseen", "8000\nUnseen",
        "Base\nSeen", "7600\nSeen", "8000\nSeen"
    ]
    x_pos = np.array([1, 2, 3, 4.5, 5.5, 6.5])

    tier_matrix = np.zeros((4, len(x_pos))) # rows: tiers, cols: configs

    # Populate Unseen
    m7600_u = metrics_by_model["checkpoint-7600"]["unseen"]
    m8000_u = metrics_by_model["checkpoint-8000"]["unseen"]
    tier_matrix[0, 0] = m7600_u["baseline_quality_tiers"]["high_ge_080"]
    tier_matrix[1, 0] = m7600_u["baseline_quality_tiers"]["medium_050_080"]
    tier_matrix[2, 0] = m7600_u["baseline_quality_tiers"]["low_005_050"]
    tier_matrix[3, 0] = m7600_u["baseline_quality_tiers"]["failing_lt_005"]

    tier_matrix[0, 1] = m7600_u["quality_tiers"]["high_ge_080"]
    tier_matrix[1, 1] = m7600_u["quality_tiers"]["medium_050_080"]
    tier_matrix[2, 1] = m7600_u["quality_tiers"]["low_005_050"]
    tier_matrix[3, 1] = m7600_u["quality_tiers"]["failing_lt_005"]

    tier_matrix[0, 2] = m8000_u["quality_tiers"]["high_ge_080"]
    tier_matrix[1, 2] = m8000_u["quality_tiers"]["medium_050_080"]
    tier_matrix[2, 2] = m8000_u["quality_tiers"]["low_005_050"]
    tier_matrix[3, 2] = m8000_u["quality_tiers"]["failing_lt_005"]

    # Populate Seen
    m7600_s = metrics_by_model["checkpoint-7600"]["seen"]
    m8000_s = metrics_by_model["checkpoint-8000"]["seen"]
    tier_matrix[0, 3] = m7600_s["baseline_quality_tiers"]["high_ge_080"]
    tier_matrix[1, 3] = m7600_s["baseline_quality_tiers"]["medium_050_080"]
    tier_matrix[2, 3] = m7600_s["baseline_quality_tiers"]["low_005_050"]
    tier_matrix[3, 3] = m7600_s["baseline_quality_tiers"]["failing_lt_005"]

    tier_matrix[0, 4] = m7600_s["quality_tiers"]["high_ge_080"]
    tier_matrix[1, 4] = m7600_s["quality_tiers"]["medium_050_080"]
    tier_matrix[2, 4] = m7600_s["quality_tiers"]["low_005_050"]
    tier_matrix[3, 4] = m7600_s["quality_tiers"]["failing_lt_005"]

    tier_matrix[0, 5] = m8000_s["quality_tiers"]["high_ge_080"]
    tier_matrix[1, 5] = m8000_s["quality_tiers"]["medium_050_080"]
    tier_matrix[2, 5] = m8000_s["quality_tiers"]["low_005_050"]
    tier_matrix[3, 5] = m8000_s["quality_tiers"]["failing_lt_005"]

    bottom = np.zeros(len(x_pos))
    for t_idx, (t_name, t_col) in enumerate(zip(tier_labels, tier_colors)):
        vals = tier_matrix[t_idx]
        ax2.bar(x_pos, vals, bottom=bottom, width=0.65, label=t_name, color=t_col, alpha=0.88)
        # annotate numbers on high tier
        for xp, val, b in zip(x_pos, vals, bottom):
            if val >= 10.0:
                ax2.text(xp, b + val / 2, f"{val:.1f}%", ha="center", va="center", color="white", fontsize=8, fontweight="bold")
        bottom += vals

    ax2.set_xticks(x_pos)
    ax2.set_xticklabels(col_names, fontsize=9)
    ax2.set_ylabel("Word Share (%)", fontsize=11, fontweight="bold")
    ax2.set_ylim(0, 105)
    ax2.set_title("2. Quality Tier Composition: Unseen Test vs Seen Train", fontsize=12, fontweight="bold")
    ax2.legend(loc="upper right", fontsize=8.5)
    ax2.grid(True, linestyle="--", alpha=0.3, axis="y")

    # ----------------------------------------------------
    # Panel 3: Paired Win / Tie / Loss on Unseen Verses
    # ----------------------------------------------------
    ax3 = axes[1, 0]
    p_models = ["checkpoint-7600", "checkpoint-8000"]
    p_labels = ["Checkpoint-7600\n(Unseen Held-Out)", "Checkpoint-8000\n(Unseen Held-Out)"]
    x3 = np.arange(len(p_models))
    width3 = 0.24

    wins = [metrics_by_model[m]["unseen"]["paired_shift"]["win_rate_pct"] for m in p_models]
    ties = [metrics_by_model[m]["unseen"]["paired_shift"]["tie_rate_pct"] for m in p_models]
    losses = [metrics_by_model[m]["unseen"]["paired_shift"]["loss_rate_pct"] for m in p_models]

    rects1 = ax3.bar(x3 - width3, wins, width3, label="Win (Δ > +0.02)", color="#2ca02c", alpha=0.85)
    rects2 = ax3.bar(x3, ties, width3, label="Tie (|Δ| ≤ 0.02)", color="#ff7f0e", alpha=0.85)
    rects3 = ax3.bar(x3 + width3, losses, width3, label="Loss (Δ < -0.02)", color="#d62728", alpha=0.85)

    def autolabel(rects):
        for rect in rects:
            h = rect.get_height()
            ax3.annotate(f"{h:.1f}%", xy=(rect.get_x() + rect.get_width() / 2, h),
                         xytext=(0, 3), textcoords="offset points", ha="center", va="bottom", fontsize=9, fontweight="bold")

    autolabel(rects1)
    autolabel(rects2)
    autolabel(rects3)

    ax3.set_xticks(x3)
    ax3.set_xticklabels(p_labels, fontsize=10, fontweight="bold")
    ax3.set_ylabel("Word Pairs (%)", fontsize=11, fontweight="bold")
    ax3.set_ylim(0, 100)
    ax3.set_title("3. Paired Head-to-Head vs. Baseline on Unseen Verses (17,762 words)", fontsize=12, fontweight="bold")
    ax3.legend(loc="upper right", fontsize=9)
    ax3.grid(True, linestyle="--", alpha=0.3, axis="y")

    # ----------------------------------------------------
    # Panel 4: Generalization Gap (Mean Delta on Seen vs Unseen)
    # ----------------------------------------------------
    ax4 = axes[1, 1]
    xg = np.arange(2)
    wg = 0.35

    delta_unseen_7600 = metrics_by_model["checkpoint-7600"]["unseen"]["paired_shift"]["mean_delta"]
    delta_seen_7600 = metrics_by_model["checkpoint-7600"]["seen"]["paired_shift"]["mean_delta"]

    delta_unseen_8000 = metrics_by_model["checkpoint-8000"]["unseen"]["paired_shift"]["mean_delta"]
    delta_seen_8000 = metrics_by_model["checkpoint-8000"]["seen"]["paired_shift"]["mean_delta"]

    unseen_deltas = [delta_unseen_7600, delta_unseen_8000]
    seen_deltas = [delta_seen_7600, delta_seen_8000]

    b_unseen = ax4.bar(xg - wg / 2, unseen_deltas, wg, label="Unseen Test Δ (Generalization)", color="#1f77b4", alpha=0.85)
    b_seen = ax4.bar(xg + wg / 2, seen_deltas, wg, label="Seen Train Δ (In-Sample Fit)", color="#9467bd", alpha=0.85)

    for b in b_unseen:
        h = b.get_height()
        ax4.annotate(f"{h:+.4f}", xy=(b.get_x() + b.get_width() / 2, h),
                     xytext=(0, 3 if h >= 0 else -12), textcoords="offset points", ha="center", va="bottom", fontsize=9.5, fontweight="bold")
    for b in b_seen:
        h = b.get_height()
        ax4.annotate(f"{h:+.4f}", xy=(b.get_x() + b.get_width() / 2, h),
                     xytext=(0, 3 if h >= 0 else -12), textcoords="offset points", ha="center", va="bottom", fontsize=9.5, fontweight="bold")

    ax4.set_xticks(xg)
    ax4.set_xticklabels(["Checkpoint-7600", "Checkpoint-8000"], fontsize=10, fontweight="bold")
    ax4.set_ylabel("Mean Confidence Delta (Δ)", fontsize=11, fontweight="bold")
    ax4.axhline(0, color="black", linestyle="-", linewidth=0.8)
    ax4.set_title("4. Generalization vs. Memorization (Mean Δ vs. Baseline)\n(Gap = Seen Δ − Unseen Δ)", fontsize=12, fontweight="bold")
    ax4.legend(loc="upper left", fontsize=9)
    ax4.grid(True, linestyle="--", alpha=0.3, axis="y")

    plt.suptitle("Cherokee New Testament Benchmark: Generalization vs. Memorization Evaluation\n(1,749 Verses, 23,035 Words | 479 Seen / 1,270 Unseen)", fontsize=15, fontweight="bold", y=0.98)

    fig.savefig(output_path, bbox_inches="tight")
    plt.close(fig)
    logger.info("Saved dashboard to %s", output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark Cherokee New Testament models with train/test isolation.")
    parser.add_argument("--device", default="mps" if torch.backends.mps.is_available() else "cpu")
    parser.add_argument("--force-rescore", action="store_true", default=False)
    parser.add_argument("--max-verses", type=int, default=None, help="Limit number of verses for debugging")
    args = parser.parse_args()

    token = load_hf_token()
    train_stems, valid_stems, test_stems = load_seen_and_unseen_stems()
    baseline_records = load_baseline_records()

    if args.max_verses:
        logger.info("DEBUG MODE: Restricting to first %d verses", args.max_verses)
        baseline_records = baseline_records[:args.max_verses]

    # Evaluate 7600
    logger.info("--- Evaluating Checkpoint-7600 ---")
    m7600_records = evaluate_bible_model(
        model_key="checkpoint-7600",
        repo=MODELS["checkpoint-7600"]["repo"],
        baseline_records=baseline_records,
        token=token,
        device=args.device,
        force_rescore=args.force_rescore,
        max_verses=args.max_verses,
    )

    if torch.backends.mps.is_available():
        torch.mps.empty_cache()

    # Evaluate 8000
    logger.info("--- Evaluating Checkpoint-8000 ---")
    m8000_records = evaluate_bible_model(
        model_key="checkpoint-8000",
        repo=MODELS["checkpoint-8000"]["repo"],
        baseline_records=baseline_records,
        token=token,
        device=args.device,
        force_rescore=args.force_rescore,
        max_verses=args.max_verses,
    )

    # Compute metrics for each model across splits
    logger.info("--- Computing Split Metrics ---")
    splits = ["unseen", "seen", "all"]
    metrics_by_model: Dict[str, Dict[str, Dict[str, Any]]] = {
        "checkpoint-7600": {},
        "checkpoint-8000": {},
    }

    for m_key, recs in [("checkpoint-7600", m7600_records), ("checkpoint-8000", m8000_records)]:
        # Unseen (Held-Out)
        metrics_by_model[m_key]["unseen"] = compute_split_metrics(
            baseline_records, recs, is_seen_filter=False, seen_stems=train_stems
        )
        # Seen (Train)
        metrics_by_model[m_key]["seen"] = compute_split_metrics(
            baseline_records, recs, is_seen_filter=True, seen_stems=train_stems
        )
        # All (Combined)
        metrics_by_model[m_key]["all"] = compute_split_metrics(
            baseline_records, recs, is_seen_filter=None, seen_stems=None
        )

    # Plot dashboard
    dashboard_path = ARTIFACT_DIR / "bible_model_comparison_dashboard.png"
    plot_bible_dashboard(metrics_by_model, dashboard_path)

    # Create summary JSON artifact
    def clean_metrics(d: Dict[str, Any]) -> Dict[str, Any]:
        return {k: v for k, v in d.items() if not k.startswith("raw_")}

    summary_out: Dict[str, Any] = {
        "dataset": "Cherokee New Testament (Matthew & Mark)",
        "total_verses": len(baseline_records),
        "seen_train_verses": len([r for r in baseline_records if Path(r["audio_path"]).stem in train_stems]),
        "unseen_test_verses": len([r for r in baseline_records if Path(r["audio_path"]).stem not in train_stems]),
        "models": {
            "checkpoint-7600": {
                "unseen_held_out": clean_metrics(metrics_by_model["checkpoint-7600"]["unseen"]),
                "seen_train": clean_metrics(metrics_by_model["checkpoint-7600"]["seen"]),
                "combined_all": clean_metrics(metrics_by_model["checkpoint-7600"]["all"]),
            },
            "checkpoint-8000": {
                "unseen_held_out": clean_metrics(metrics_by_model["checkpoint-8000"]["unseen"]),
                "seen_train": clean_metrics(metrics_by_model["checkpoint-8000"]["seen"]),
                "combined_all": clean_metrics(metrics_by_model["checkpoint-8000"]["all"]),
            },
        },
    }

    summary_json_path = ARTIFACT_DIR / "bible_models_comparison_summary.json"
    with open(summary_json_path, "w", encoding="utf-8") as f:
        json.dump(summary_out, f, indent=2)
    logger.info("Saved summary JSON to %s", summary_json_path)

    # Print high-level overview
    print("\n" + "=" * 80)
    print("CHEROKEE NEW TESTAMENT BENCHMARK SUMMARY")
    print("=" * 80)
    for m_key in ["checkpoint-7600", "checkpoint-8000"]:
        print(f"\n[{m_key.upper()}]")
        for sp in ["unseen", "seen", "all"]:
            m = metrics_by_model[m_key][sp]
            wl = m["word_level"]
            bwl = m["baseline_word_level"]
            ps = m["paired_shift"]
            qt = m["quality_tiers"]
            bqt = m["baseline_quality_tiers"]
            print(f"  Split: {sp.upper():7s} ({m['verses_count']} verses, {m['words_count']} words)")
            print(f"    Word Mean:     {wl['mean']:.4f} vs Base {bwl['mean']:.4f} (Δ = {ps['mean_delta']:+.4f})")
            print(f"    Word Median:   {wl['median']:.4f} vs Base {bwl['median']:.4f} (IQR: {wl['iqr']:.4f})")
            print(f"    High (≥0.80):  {qt['high_ge_080']:.1f}% vs Base {bqt['high_ge_080']:.1f}%")
            print(f"    Fail (<0.05):  {qt['failing_lt_005']:.1f}% vs Base {bqt['failing_lt_005']:.1f}%")
            print(f"    Win / Tie / Loss: {ps['win_rate_pct']:.1f}% / {ps['tie_rate_pct']:.1f}% / {ps['loss_rate_pct']:.1f}%")
    print("=" * 80)


if __name__ == "__main__":
    main()
