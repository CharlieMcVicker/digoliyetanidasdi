#!/usr/bin/env python3
"""
scripts/benchmark_stv_models.py

Benchmarks checkpoint-7600 and checkpoint-8000 against baseline on
4 diverse Saving the Voices interviews (859 turns, 11,789 words, 189.7 min speech):
- stv_0003_dj_vann (Male elder, classic reference speaker)
- stv_0005_martin_ballou (Male elder, casual/conversational)
- stv_0010_mary_mccoy (Female elder, highest baseline confidence)
- stv_0011_naomi_stone (Female speaker, moderate baseline)

Outputs:
- data/benchmarks/stv/{model}_{source_id}.json
- <artifact_dir>/stv_model_comparison_dashboard.png
- <artifact_dir>/stv_models_comparison_summary.json
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
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch

matplotlib.rcParams['font.sans-serif'] = ['Noto Sans Cherokee', 'Plantagenet Cherokee', 'DejaVu Sans', 'Arial']
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
from digohwelisgi.core.alignment.models import TextChunk
from scripts.align_stv_poc import (
    prepare_turn_clauses,
    partition_words_into_phrases,
    SYL_RE,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("benchmark_stv")

DATA_DIR = REPO_ROOT / "data/saving-the-voices"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"
TURN_AUDIO_DIR = DATA_DIR / "turn_audio"
ALIGNMENTS_DIR = DATA_DIR / "alignments"
BENCHMARKS_DIR = REPO_ROOT / "data/benchmarks/stv"
ARTIFACT_DIR = Path("/Users/julietmcvicker/.gemini/antigravity-cli/brain/6349a8b6-0ba2-4394-847c-f3a74cb51acc")

INTERVIEWS = [
    {
        "source_id": "stv_0003_dj_vann",
        "asset_id": "saving-the-voices-0003-dj-vann",
        "title": "DJ Vann (ᎦᎨᏓ)",
        "speaker_gender": "Male",
    },
    {
        "source_id": "stv_0005_martin_ballou",
        "asset_id": "saving-the-voices-0005-martin-ballou",
        "title": "Martin Ballou",
        "speaker_gender": "Male",
    },
    {
        "source_id": "stv_0010_mary_mccoy",
        "asset_id": "saving-the-voices-0010-mary-mccoy",
        "title": "Mary McCoy",
        "speaker_gender": "Female",
    },
    {
        "source_id": "stv_0011_naomi_stone",
        "asset_id": "saving-the-voices-0011-naomi-stone",
        "title": "Naomi Stone",
        "speaker_gender": "Female",
    },
]

MODELS = {
    "checkpoint-7600": {
        "repo": "charliemcvicker/bible-augmentation-20261103-214935-wav2vec2-large-xlsr",
        "label": "Chkpt-7600 (Conversational Winner)",
        "color": "#38bdf8",
    },
    "checkpoint-8000": {
        "repo": "charliemcvicker/bible-augmentation-checkpoint-8000-wav2vec2-large-xlsr",
        "label": "Chkpt-8000 (Bible Specialist Winner)",
        "color": "#a855f7",
    },
}
BASELINE_COLOR = "#f43f5e"

TARGET_TOKENS = ["skina", "skwu", "kehv", "ohsta", "tsikehv", "yuhsti", "na", "ski"]


def load_token() -> str:
    token_file = Path.home() / ".cache/huggingface/token"
    if token_file.exists():
        return token_file.read_text().strip()
    return os.environ.get("HF_TOKEN", "")


def load_baseline_interview_data(source_id: str) -> Dict[str, Any]:
    baseline_path = ALIGNMENTS_DIR / f"{source_id}_aligned.json"
    with open(baseline_path, "r", encoding="utf-8") as f:
        return json.load(f)


def evaluate_interview_model(
    model_key: str,
    repo: str,
    interview_meta: Dict[str, str],
    token: str,
    device: str = "mps",
    model: Optional[CherokeeASRModel] = None,
    aligner: Optional[CTCSegmentationAligner] = None,
) -> Dict[str, Any]:
    source_id = interview_meta["source_id"]
    asset_id = interview_meta["asset_id"]

    out_file = BENCHMARKS_DIR / f"{model_key.replace('-', '_')}_{source_id}.json"
    if out_file.exists():
        logger.info("Loading cached benchmark results from %s", out_file)
        with open(out_file, "r", encoding="utf-8") as f:
            return json.load(f)

    logger.info("Evaluating [%s] on %s (%s)...", model_key, source_id, interview_meta["title"])
    t0 = time.time()

    transcript_path = TRANSCRIPTS_DIR / f"{asset_id}.json"
    with open(transcript_path, "r", encoding="utf-8") as f:
        t_data = json.load(f)
    segments = t_data.get("segments", [])

    valid_segments = [
        s for s in segments
        if s.get("startMs") is not None
        and s.get("endMs") is not None
        and s.get("endMs") > s.get("startMs")
        and SYL_RE.search(s.get("text") or "")
    ]

    interview_turn_dir = TURN_AUDIO_DIR / source_id
    turns_results: List[Dict[str, Any]] = []
    all_words: List[Dict[str, Any]] = []
    phrases_count = 0

    for seg_idx, seg in enumerate(valid_segments, 1):
        seg_id = str(seg.get("id") or f"seg-{seg_idx:03d}")
        raw_text = (seg.get("text") or "").strip()
        en_trans = (seg.get("translation") or "").strip() or None
        start_ms = int(seg["startMs"])
        end_ms = int(seg["endMs"])
        turn_dur_sec = (end_ms - start_ms) / 1000.0

        clauses = prepare_turn_clauses(raw_text, en_trans)
        if not clauses:
            continue

        turn_wav_path = interview_turn_dir / f"{seg_id}.wav"
        if not turn_wav_path.exists():
            logger.warning("Turn WAV missing: %s", turn_wav_path)
            continue

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

        try:
            turn_alignment = aligner.align(
                audio_input=str(turn_wav_path),
                chunks=turn_chunks,
                source_id=f"{source_id}_{seg_id}",
                asr_model=model,
                source_metadata=turn_meta,
            )
        except Exception as e:
            logger.error("Error aligning %s in %s: %s", seg_id, source_id, e)
            continue

        turn_words: List[Dict[str, Any]] = []
        for ac in turn_alignment.aligned_chunks:
            cid = ac.chunk_id
            c_clean_syl = turn_meta[cid]["syllabary"].split()
            c_words = ac.words

            sub_phrases = partition_words_into_phrases(
                words=c_words,
                clean_syl_words=c_clean_syl,
                max_duration_sec=15.0,
                min_pause_sec=0.25,
            )

            for p_words, p_syl in sub_phrases:
                if not p_words:
                    continue
                phrases_count += 1
                for w in p_words:
                    emitted = (w.emitted_word or w.word).strip()
                    conf = round(float(w.confidence), 4)
                    w_dict = {
                        "word": emitted,
                        "confidence": conf,
                        "flagged": bool(w.flagged),
                        "turn_id": seg_id,
                    }
                    turn_words.append(w_dict)
                    all_words.append(w_dict)

        confs = [w["confidence"] for w in turn_words]
        turns_results.append({
            "turn_id": seg_id,
            "mean_confidence": round(float(np.mean(confs)), 4) if confs else 0.0,
            "words_count": len(turn_words),
            "words": turn_words,
        })

        if (seg_idx % 50 == 0) or (seg_idx == len(valid_segments)):
            elapsed = time.time() - t0
            rate = seg_idx / elapsed
            logger.info("[%s - %s] %d/%d turns (%.1f turns/s)", model_key, source_id, seg_idx, len(valid_segments), rate)

    elapsed_total = round(time.time() - t0, 2)
    word_confs = [w["confidence"] for w in all_words]

    payload = {
        "model_key": model_key,
        "source_id": source_id,
        "asset_id": asset_id,
        "elapsed_sec": elapsed_total,
        "aligned_turns": len(turns_results),
        "total_phrases": phrases_count,
        "total_words": len(all_words),
        "mean_word_confidence": round(float(np.mean(word_confs)), 4) if word_confs else 0.0,
        "median_word_confidence": round(float(np.median(word_confs)), 4) if word_confs else 0.0,
        "words": all_words,
        "turns": turns_results,
    }

    BENCHMARKS_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    return payload


def compute_stv_metrics(
    baseline_records: Dict[str, Dict[str, Any]],
    model_records: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    all_base_words: List[float] = []
    all_eval_words: List[float] = []
    word_deltas: List[float] = []

    target_tokens_counts: Dict[str, int] = {t: 0 for t in TARGET_TOKENS}
    target_tokens_confs: Dict[str, List[float]] = {t: [] for t in TARGET_TOKENS}

    per_interview: Dict[str, Dict[str, Any]] = {}

    word_wins = 0
    word_ties = 0
    word_losses = 0
    flagged_words = 0

    for inv in INTERVIEWS:
        sid = inv["source_id"]
        b_inv = baseline_records[sid]
        e_inv = model_records[sid]

        b_words = [w for p in b_inv.get("phrases", []) for w in p.get("words", [])]
        e_words = e_inv.get("words", [])

        inv_b_confs = [w["confidence"] for w in b_words]
        inv_e_confs = [w["confidence"] for w in e_words]

        all_base_words.extend(inv_b_confs)
        all_eval_words.extend(inv_e_confs)

        min_len = min(len(b_words), len(e_words))
        inv_deltas = []
        for i in range(min_len):
            bw = b_words[i]
            ew = e_words[i]
            bc = bw["confidence"]
            ec = ew["confidence"]
            wd = ec - bc
            word_deltas.append(wd)
            inv_deltas.append(wd)

            if ew.get("flagged"):
                flagged_words += 1

            if wd > 0.02:
                word_wins += 1
            elif wd < -0.02:
                word_losses += 1
            else:
                word_ties += 1

            w_clean = ew["word"].lower()
            if w_clean in target_tokens_confs:
                target_tokens_counts[w_clean] += 1
                target_tokens_confs[w_clean].append(ec)

        per_interview[sid] = {
            "title": inv["title"],
            "speaker_gender": inv["speaker_gender"],
            "base_mean": round(float(np.mean(inv_b_confs)), 4) if inv_b_confs else 0.0,
            "eval_mean": round(float(np.mean(inv_e_confs)), 4) if inv_e_confs else 0.0,
            "base_median": round(float(np.median(inv_b_confs)), 4) if inv_b_confs else 0.0,
            "eval_median": round(float(np.median(inv_e_confs)), 4) if inv_e_confs else 0.0,
            "mean_delta": round(float(np.mean(inv_deltas)), 4) if inv_deltas else 0.0,
            "words_count": len(e_words),
        }

    def calc_dist(arr: List[float]) -> Dict[str, float]:
        if not arr:
            return {}
        a = np.array(arr)
        return {
            "mean": round(float(np.mean(a)), 4),
            "std": round(float(np.std(a)), 4),
            "median": round(float(np.median(a)), 4),
            "p25": round(float(np.percentile(a, 25)), 4),
            "p75": round(float(np.percentile(a, 75)), 4),
            "iqr": round(float(np.percentile(a, 75) - np.percentile(a, 25)), 4),
            "p10": round(float(np.percentile(a, 10)), 4),
            "p90": round(float(np.percentile(a, 90)), 4),
        }

    def calc_tiers(arr: List[float]) -> Dict[str, float]:
        n = len(arr)
        if n == 0:
            return {}
        return {
            "high_ge_80": round(sum(1 for c in arr if c >= 0.80) / n * 100, 2),
            "medium_50_80": round(sum(1 for c in arr if 0.50 <= c < 0.80) / n * 100, 2),
            "low_05_50": round(sum(1 for c in arr if 0.05 <= c < 0.50) / n * 100, 2),
            "failing_lt_05": round(sum(1 for c in arr if c < 0.05) / n * 100, 2),
        }

    total_words = len(all_eval_words)
    return {
        "total_words": total_words,
        "word_distribution": calc_dist(all_eval_words),
        "quality_tiers": calc_tiers(all_eval_words),
        "flagged_words_pct": round(flagged_words / max(1, total_words) * 100, 2),
        "per_interview": per_interview,
        "paired_deltas": {
            "mean_word_delta": round(float(np.mean(word_deltas)), 4) if word_deltas else 0.0,
            "median_word_delta": round(float(np.median(word_deltas)), 4) if word_deltas else 0.0,
            "word_wins_pct": round(word_wins / max(1, total_words) * 100, 2),
            "word_ties_pct": round(word_ties / max(1, total_words) * 100, 2),
            "word_losses_pct": round(word_losses / max(1, total_words) * 100, 2),
        },
        "target_tokens": {
            t: {
                "count": target_tokens_counts[t],
                "mean_conf": round(float(np.mean(target_tokens_confs[t])), 4) if target_tokens_confs[t] else 0.0,
            }
            for t in TARGET_TOKENS
        },
        "raw_words": all_eval_words,
        "raw_deltas": word_deltas,
    }


def plot_stv_dashboard(
    base_metrics: Dict[str, Any],
    m7600_metrics: Dict[str, Any],
    m8000_metrics: Dict[str, Any],
) -> Path:
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    fig.patch.set_facecolor("#0f172a")

    for row in axes:
        for ax in row:
            ax.set_facecolor("#1e293b")
            ax.tick_params(colors="#cbd5e1")
            ax.xaxis.label.set_color("#f8fafc")
            ax.yaxis.label.set_color("#f8fafc")
            ax.title.set_color("#f8fafc")
            for spine in ax.spines.values():
                spine.set_color("#334155")

    # Panel 1: Overall Word Confidence Density (KDE / Histogram)
    ax1 = axes[0, 0]
    bins = np.linspace(0, 1.0, 51)
    ax1.hist(base_metrics["raw_words"], bins=bins, alpha=0.45, density=True, color=BASELINE_COLOR, label=f"Baseline (med={base_metrics['word_distribution']['median']:.3f})")
    ax1.hist(m7600_metrics["raw_words"], bins=bins, alpha=0.45, density=True, color=MODELS["checkpoint-7600"]["color"], label=f"Chkpt-7600 (med={m7600_metrics['word_distribution']['median']:.3f})")
    ax1.hist(m8000_metrics["raw_words"], bins=bins, alpha=0.45, density=True, color=MODELS["checkpoint-8000"]["color"], label=f"Chkpt-8000 (med={m8000_metrics['word_distribution']['median']:.3f})")
    ax1.set_title("Word Confidence Distribution (Density)", fontsize=13, fontweight="bold")
    ax1.set_xlabel("Confidence Score (0.0 to 1.0)")
    ax1.set_ylabel("Probability Density")
    ax1.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc")
    ax1.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    # Panel 2: Mean Word Confidence by Interview (Grouped Bar Chart across 4 Speakers)
    ax2 = axes[0, 1]
    inv_keys = [inv["source_id"] for inv in INTERVIEWS]
    inv_labels = [f"{inv['title']}\n({inv['speaker_gender']})" for inv in INTERVIEWS]
    x = np.arange(len(inv_keys))
    w = 0.26

    base_means = [base_metrics["per_interview"][k]["base_mean"] for k in inv_keys]
    m7600_means = [m7600_metrics["per_interview"][k]["eval_mean"] for k in inv_keys]
    m8000_means = [m8000_metrics["per_interview"][k]["eval_mean"] for k in inv_keys]

    ax2.bar(x - w, base_means, w, label="Baseline", color=BASELINE_COLOR, alpha=0.85)
    ax2.bar(x, m7600_means, w, label="Chkpt-7600 (Conversational)", color=MODELS["checkpoint-7600"]["color"], alpha=0.85)
    ax2.bar(x + w, m8000_means, w, label="Chkpt-8000 (Bible Specialist)", color=MODELS["checkpoint-8000"]["color"], alpha=0.85)

    ax2.set_xticks(x)
    ax2.set_xticklabels(inv_labels, fontsize=9)
    ax2.set_title("Mean Word Confidence by Speaker & Interview", fontsize=13, fontweight="bold")
    ax2.set_ylabel("Mean Confidence")
    ax2.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc")
    ax2.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    # Panel 3: Quality Tier Breakdown (% High, Medium, Low, Failing)
    ax3 = axes[1, 0]
    tiers_labels = ["Baseline", "Chkpt-7600", "Chkpt-8000"]
    tier_high = [base_metrics["quality_tiers"]["high_ge_80"], m7600_metrics["quality_tiers"]["high_ge_80"], m8000_metrics["quality_tiers"]["high_ge_80"]]
    tier_med = [base_metrics["quality_tiers"]["medium_50_80"], m7600_metrics["quality_tiers"]["medium_50_80"], m8000_metrics["quality_tiers"]["medium_50_80"]]
    tier_low = [base_metrics["quality_tiers"]["low_05_50"], m7600_metrics["quality_tiers"]["low_05_50"], m8000_metrics["quality_tiers"]["low_05_50"]]
    tier_fail = [base_metrics["quality_tiers"]["failing_lt_05"], m7600_metrics["quality_tiers"]["failing_lt_05"], m8000_metrics["quality_tiers"]["failing_lt_05"]]

    x_t = np.arange(len(tiers_labels))
    w_t = 0.55
    ax3.bar(x_t, tier_high, w_t, label="High (≥80%)", color="#22c55e", alpha=0.9)
    ax3.bar(x_t, tier_med, w_t, bottom=tier_high, label="Medium (50–80%)", color="#eab308", alpha=0.9)
    ax3.bar(x_t, tier_low, w_t, bottom=[i+j for i, j in zip(tier_high, tier_med)], label="Low (5–50%)", color="#f97316", alpha=0.9)
    ax3.bar(x_t, tier_fail, w_t, bottom=[i+j+k for i, j, k in zip(tier_high, tier_med, tier_low)], label="Failing (<5%)", color="#ef4444", alpha=0.9)

    for i in range(len(tiers_labels)):
        ax3.text(i, max(3, tier_high[i] / 2), f"{tier_high[i]:.1f}%", ha="center", va="center", color="#0f172a", fontweight="bold", fontsize=10)

    ax3.set_xticks(x_t)
    ax3.set_xticklabels(tiers_labels, fontsize=11, fontweight="bold")
    ax3.set_title("Word Reliability Quality Tiers (%)", fontsize=13, fontweight="bold")
    ax3.set_ylabel("Percentage of Total Words")
    ax3.set_ylim(0, 105)
    ax3.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc", loc="upper right")
    ax3.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    # Panel 4: Frequent Syncopated / Colloquial Tokens Mean Confidence Comparison
    ax4 = axes[1, 1]
    t_tokens = TARGET_TOKENS
    x_tok = np.arange(len(t_tokens))
    w_tok = 0.26

    base_tok_confs = [base_metrics["target_tokens"][t]["mean_conf"] for t in t_tokens]
    m7600_tok_confs = [m7600_metrics["target_tokens"][t]["mean_conf"] for t in t_tokens]
    m8000_tok_confs = [m8000_metrics["target_tokens"][t]["mean_conf"] for t in t_tokens]

    ax4.bar(x_tok - w_tok, base_tok_confs, w_tok, label="Baseline", color=BASELINE_COLOR, alpha=0.85)
    ax4.bar(x_tok, m7600_tok_confs, w_tok, label="Chkpt-7600 (Conversational)", color=MODELS["checkpoint-7600"]["color"], alpha=0.85)
    ax4.bar(x_tok + w_tok, m8000_tok_confs, w_tok, label="Chkpt-8000 (Bible Specialist)", color=MODELS["checkpoint-8000"]["color"], alpha=0.85)

    ax4.set_xticks(x_tok)
    ax4.set_xticklabels(t_tokens, rotation=25, fontsize=9)
    ax4.set_title("Target Syncopated/Colloquial Token Confidences", fontsize=13, fontweight="bold")
    ax4.set_ylabel("Mean Confidence")
    ax4.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc")
    ax4.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    plt.suptitle("Saving the Voices Benchmark (4 Diverse Interviews, 859 Turns): Baseline vs. Chkpt-7600 vs. Chkpt-8000", fontsize=15, fontweight="bold", color="#f8fafc", y=0.98)
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])

    out_fig = ARTIFACT_DIR / "stv_model_comparison_dashboard.png"
    plt.savefig(out_fig, dpi=200, bbox_inches="tight")
    logger.info("Saved STV dashboard figure to %s", out_fig)
    return out_fig


def main():
    parser = argparse.ArgumentParser(description="Benchmark STV alignment models on 4 interviews")
    parser.add_argument("--device", default="mps" if torch.backends.mps.is_available() else "cpu", help="Compute device")
    args = parser.parse_args()

    token = load_token()

    # Load baseline records for all 4 interviews
    baseline_records: Dict[str, Dict[str, Any]] = {}
    for inv in INTERVIEWS:
        sid = inv["source_id"]
        baseline_records[sid] = load_baseline_interview_data(sid)

    # Calculate baseline metrics across the 4 interviews
    base_all_words = []
    base_word_deltas = []  # delta with self is 0
    base_per_inv = {}
    base_tok_confs = {t: [] for t in TARGET_TOKENS}
    base_tok_counts = {t: 0 for t in TARGET_TOKENS}

    for inv in INTERVIEWS:
        sid = inv["source_id"]
        b_inv = baseline_records[sid]
        b_words = [w for p in b_inv.get("phrases", []) for w in p.get("words", [])]
        inv_confs = [w["confidence"] for w in b_words]
        base_all_words.extend(inv_confs)
        for w in b_words:
            w_clean = w["word"].lower()
            if w_clean in base_tok_confs:
                base_tok_counts[w_clean] += 1
                base_tok_confs[w_clean].append(w["confidence"])
        base_per_inv[sid] = {
            "title": inv["title"],
            "speaker_gender": inv["speaker_gender"],
            "base_mean": round(float(np.mean(inv_confs)), 4) if inv_confs else 0.0,
            "base_median": round(float(np.median(inv_confs)), 4) if inv_confs else 0.0,
            "words_count": len(b_words),
        }

    def calc_dist_simple(arr: List[float]) -> Dict[str, float]:
        a = np.array(arr)
        return {
            "mean": round(float(np.mean(a)), 4),
            "std": round(float(np.std(a)), 4),
            "median": round(float(np.median(a)), 4),
            "p25": round(float(np.percentile(a, 25)), 4),
            "p75": round(float(np.percentile(a, 75)), 4),
            "iqr": round(float(np.percentile(a, 75) - np.percentile(a, 25)), 4),
            "p10": round(float(np.percentile(a, 10)), 4),
            "p90": round(float(np.percentile(a, 90)), 4),
        }

    def calc_tiers_simple(arr: List[float]) -> Dict[str, float]:
        n = len(arr)
        return {
            "high_ge_80": round(sum(1 for c in arr if c >= 0.80) / n * 100, 2),
            "medium_50_80": round(sum(1 for c in arr if 0.50 <= c < 0.80) / n * 100, 2),
            "low_05_50": round(sum(1 for c in arr if 0.05 <= c < 0.50) / n * 100, 2),
            "failing_lt_05": round(sum(1 for c in arr if c < 0.05) / n * 100, 2),
        }

    base_metrics = {
        "total_words": len(base_all_words),
        "word_distribution": calc_dist_simple(base_all_words),
        "quality_tiers": calc_tiers_simple(base_all_words),
        "per_interview": base_per_inv,
        "target_tokens": {
            t: {
                "count": base_tok_counts[t],
                "mean_conf": round(float(np.mean(base_tok_confs[t])), 4) if base_tok_confs[t] else 0.0,
            }
            for t in TARGET_TOKENS
        },
        "raw_words": base_all_words,
    }

    # Evaluate Checkpoint-7600
    m7600_records = {}
    logger.info("Loading Checkpoint-7600 model on %s...", args.device)
    m7600_model = CherokeeASRModel.from_pretrained_or_best(
        path_or_repo=MODELS["checkpoint-7600"]["repo"],
        token=token,
        device=args.device,
    )
    m7600_cfg = create_cherokee_ctc_config(
        enable_vad_soft_masking=True,
        vad_p_low=0.15,
        vad_p_high=0.60,
        vad_pad_ms=60,
        cache=True,
        cache_dir=BENCHMARKS_DIR / ".cache_checkpoint_7600",
    )
    m7600_aligner = CTCSegmentationAligner(model=m7600_model, config=m7600_cfg)

    for inv in INTERVIEWS:
        m7600_records[inv["source_id"]] = evaluate_interview_model(
            model_key="checkpoint-7600",
            repo=MODELS["checkpoint-7600"]["repo"],
            interview_meta=inv,
            token=token,
            device=args.device,
            model=m7600_model,
            aligner=m7600_aligner,
        )
    m7600_metrics = compute_stv_metrics(baseline_records, m7600_records)

    # Free 7600 model from GPU memory before loading 8000
    del m7600_model
    del m7600_aligner
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()

    # Evaluate Checkpoint-8000
    m8000_records = {}
    logger.info("Loading Checkpoint-8000 model on %s...", args.device)
    m8000_model = CherokeeASRModel.from_pretrained_or_best(
        path_or_repo=MODELS["checkpoint-8000"]["repo"],
        token=token,
        device=args.device,
    )
    m8000_cfg = create_cherokee_ctc_config(
        enable_vad_soft_masking=True,
        vad_p_low=0.15,
        vad_p_high=0.60,
        vad_pad_ms=60,
        cache=True,
        cache_dir=BENCHMARKS_DIR / ".cache_checkpoint_8000",
    )
    m8000_aligner = CTCSegmentationAligner(model=m8000_model, config=m8000_cfg)

    for inv in INTERVIEWS:
        m8000_records[inv["source_id"]] = evaluate_interview_model(
            model_key="checkpoint-8000",
            repo=MODELS["checkpoint-8000"]["repo"],
            interview_meta=inv,
            token=token,
            device=args.device,
            model=m8000_model,
            aligner=m8000_aligner,
        )
    m8000_metrics = compute_stv_metrics(baseline_records, m8000_records)

    # Plot dashboard
    plot_stv_dashboard(
        base_metrics=base_metrics,
        m7600_metrics=m7600_metrics,
        m8000_metrics=m8000_metrics,
    )

    # Save summary JSON
    m7600_clean = {k: v for k, v in m7600_metrics.items() if not k.startswith("raw_")}
    m8000_clean = {k: v for k, v in m8000_metrics.items() if not k.startswith("raw_")}
    base_clean = {k: v for k, v in base_metrics.items() if not k.startswith("raw_")}

    summary_out = {
        "dataset": "Saving the Voices (4 Diverse Interviews: 0003, 0005, 0010, 0011)",
        "interviews_count": len(INTERVIEWS),
        "baseline": base_clean,
        "checkpoint-7600": m7600_clean,
        "checkpoint-8000": m8000_clean,
    }

    with open(ARTIFACT_DIR / "stv_models_comparison_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary_out, f, indent=2)

    logger.info("Saved summary to %s", ARTIFACT_DIR / "stv_models_comparison_summary.json")
    print(json.dumps(summary_out, indent=2))


if __name__ == "__main__":
    main()
