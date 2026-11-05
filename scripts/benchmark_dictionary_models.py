#!/usr/bin/env python3
"""
scripts/benchmark_dictionary_models.py

Benchmarks checkpoint-7600 and checkpoint-8000 on all 1,857 sentences
of the 1975 Durbin Feeling Dictionary against the baseline model.

Evaluates:
- Distributional statistics (Mean, Median, IQR, P10, P90)
- Quality tier breakdown (High >=0.80, Medium 0.50-0.80, Low 0.05-0.50, Failing <0.05)
- Paired word-level and sentence-level delta shifts (Win / Tie / Loss)
- Sentence length vs. confidence stability

Outputs:
- data/benchmarks/dictionary/checkpoint_7600_results.json
- data/benchmarks/dictionary/checkpoint_8000_results.json
- <artifact_dir>/dict_model_comparison_dashboard.png
- <artifact_dir>/dict_models_comparison_summary.json
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
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch

# Paths
REPO_ROOT = Path(__file__).resolve().parent.parent
WORKSHOP_DIR = Path("/Users/julietmcvicker/code/workshop-transcription")
if str(WORKSHOP_DIR) not in sys.path:
    sys.path.insert(0, str(WORKSHOP_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from digohwelisgi.alignment.ctc_aligner import CTCSegmentationAligner, CTCAlignerConfig
from digohwelisgi.cherokee.models.loader import CherokeeASRModel
from scripts.build_corpus import (
    clean_syllabary,
    normalize_dg_to_canonical_tth,
    clean_to_canonical_tth,
    normalize_syllabary_for_alignment,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("benchmark_dict")

SENTENCE_CSV_PATH = WORKSHOP_DIR / "data/training/processed/sentence_audio.csv"
SENTENCE_AUDIO_DIR = WORKSHOP_DIR / "data/training/processed/sentence_audio"
PHRASES_JSON_PATH = REPO_ROOT / "public/data/phrases.json"
BENCHMARKS_DIR = REPO_ROOT / "data/benchmarks/dictionary"
ARTIFACT_DIR = Path("/Users/julietmcvicker/.gemini/antigravity-cli/brain/6349a8b6-0ba2-4394-847c-f3a74cb51acc")

MODELS = {
    "checkpoint-7600": {
        "repo": "charliemcvicker/bible-augmentation-20261103-214935-wav2vec2-large-xlsr",
        "label": "Chkpt-7600 (Conversational & Bible Winner)",
        "color": "#38bdf8",  # Sky blue
    },
    "checkpoint-8000": {
        "repo": "charliemcvicker/bible-augmentation-checkpoint-8000-wav2vec2-large-xlsr",
        "label": "Chkpt-8000 (Bible Specialist Winner)",
        "color": "#a855f7",  # Purple
    },
}
BASELINE_COLOR = "#f43f5e"  # Rose


def load_token() -> str:
    token_file = Path.home() / ".cache/huggingface/token"
    if token_file.exists():
        return token_file.read_text().strip()
    return os.environ.get("HF_TOKEN", "")


def load_baseline_data() -> Dict[str, Dict[str, Any]]:
    """Loads existing baseline dictionary alignments from phrases.json."""
    logger.info("Loading baseline dictionary phrases from %s", PHRASES_JSON_PATH)
    with open(PHRASES_JSON_PATH, "r", encoding="utf-8") as f:
        phrases = json.load(f)

    baseline: Dict[str, Dict[str, Any]] = {}
    for p in phrases:
        if p.get("source_id") == "dict_feeling_1975":
            sid = p["id"].replace("dict_ex_", "")
            baseline[sid] = p

    logger.info("Loaded %d baseline dictionary phrases.", len(baseline))
    return baseline


def load_valid_sentence_rows() -> List[Dict[str, str]]:
    with open(SENTENCE_CSV_PATH, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    valid: List[Dict[str, str]] = []
    for r in rows:
        sid = (r.get("sentence_id") or "").strip()
        audio = (r.get("audio") or "").strip()
        syl = (r.get("syllabary") or "").strip()
        phon = (r.get("phonetic") or "").strip()

        if not sid or sid == "6089d9d5aa62":
            continue
        if not audio or not syl or not phon:
            continue
        wav_path = SENTENCE_AUDIO_DIR / audio
        if not wav_path.exists():
            continue
        valid.append(r)

    logger.info("Found %d valid dictionary sentences with audio on disk.", len(valid))
    return valid


def evaluate_model_on_dictionary(
    model_key: str,
    repo: str,
    valid_rows: List[Dict[str, str]],
    token: str,
    device: str = "mps",
) -> Dict[str, Any]:
    output_file = BENCHMARKS_DIR / f"{model_key.replace('-', '_')}_results.json"
    if output_file.exists():
        logger.info("Loading cached benchmark results from %s", output_file)
        with open(output_file, "r", encoding="utf-8") as f:
            return json.load(f)

    logger.info("Evaluating %s (%s) on %s...", model_key, repo, device)
    model = CherokeeASRModel.from_pretrained_or_best(
        path_or_repo=repo,
        token=token,
        device=device,
    )
    cache_dir = BENCHMARKS_DIR / f".cache_{model_key.replace('-', '_')}"
    config = CTCAlignerConfig(cache=True, cache_dir=cache_dir)
    aligner = CTCSegmentationAligner(model=model, config=config)

    t0 = time.time()
    phrases_res: Dict[str, Any] = {}

    for idx, row in enumerate(valid_rows):
        sentence_id = row["sentence_id"].strip()
        audio_filename = row["audio"].strip()
        wav_path = SENTENCE_AUDIO_DIR / audio_filename

        syl_clean = clean_syllabary(row["syllabary"])
        syl_tokens = syl_clean.split()
        phon_tth = normalize_dg_to_canonical_tth(row["phonetic"])
        phon_tokens = phon_tth.split()

        if len(phon_tokens) == len(syl_tokens):
            alignment_template = phon_tth
        else:
            alignment_template = clean_to_canonical_tth(
                normalize_syllabary_for_alignment(syl_clean)
            )

        try:
            aligned_chunk = aligner.align_verse_slice(
                audio_input=wav_path,
                chunk_id=sentence_id,
                phonetic_text=alignment_template,
                syllabary_text=syl_clean,
                asr_model=model,
                cache=True,
            )
        except Exception as e:
            logger.error("Failed aligning sentence %s: %s", sentence_id, e)
            continue

        words_data: List[Dict[str, Any]] = []
        for w in aligned_chunk.words:
            ctc_tok = clean_to_canonical_tth(w.emitted_word or w.word) or clean_to_canonical_tth(w.word)
            words_data.append(
                {
                    "word": ctc_tok,
                    "start": round(float(w.start_sec), 3),
                    "end": round(float(w.end_sec), 3),
                    "confidence": round(float(w.confidence), 4),
                    "flagged": bool(w.flagged),
                }
            )

        confs = [w["confidence"] for w in words_data]
        mean_c = round(float(np.mean(confs)), 4) if confs else 0.0
        min_c = round(float(np.min(confs)), 4) if confs else 0.0

        phrases_res[sentence_id] = {
            "sentence_id": sentence_id,
            "mean_confidence": mean_c,
            "min_confidence": min_c,
            "words": words_data,
        }

        if (idx + 1) % 400 == 0 or (idx + 1) == len(valid_rows):
            elapsed = time.time() - t0
            rate = (idx + 1) / elapsed
            logger.info("Progress [%s]: %d/%d sentences (%.1f sent/s)", model_key, idx + 1, len(valid_rows), rate)

    total_time = round(time.time() - t0, 2)
    logger.info("Completed %s evaluation in %.2fs", model_key, total_time)

    result_payload = {
        "model_key": model_key,
        "repo": repo,
        "device": device,
        "elapsed_sec": total_time,
        "sentences_count": len(phrases_res),
        "sentences": phrases_res,
    }

    BENCHMARKS_DIR.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result_payload, f, indent=2)

    return result_payload


def compute_metrics(
    baseline_data: Dict[str, Dict[str, Any]],
    eval_data: Dict[str, Any],
) -> Dict[str, Any]:
    common_ids = sorted(set(baseline_data.keys()) & set(eval_data["sentences"].keys()))

    base_word_confs: List[float] = []
    eval_word_confs: List[float] = []
    word_deltas: List[float] = []

    base_sent_confs: List[float] = []
    eval_sent_confs: List[float] = []
    sent_deltas: List[float] = []

    word_wins = 0
    word_ties = 0
    word_losses = 0

    sent_wins = 0
    sent_ties = 0
    sent_losses = 0

    flagged_count = 0
    total_words = 0

    for sid in common_ids:
        b_p = baseline_data[sid]
        e_p = eval_data["sentences"][sid]

        b_sc = b_p["mean_confidence"]
        e_sc = e_p["mean_confidence"]
        base_sent_confs.append(b_sc)
        eval_sent_confs.append(e_sc)

        s_delta = e_sc - b_sc
        sent_deltas.append(s_delta)
        if s_delta > 0.01:
            sent_wins += 1
        elif s_delta < -0.01:
            sent_losses += 1
        else:
            sent_ties += 1

        b_words = b_p.get("words", [])
        e_words = e_p.get("words", [])

        # Paired matching on words
        min_len = min(len(b_words), len(e_words))
        for i in range(min_len):
            bw = b_words[i]
            ew = e_words[i]
            bc = bw["confidence"]
            ec = ew["confidence"]
            base_word_confs.append(bc)
            eval_word_confs.append(ec)
            total_words += 1

            if ew.get("flagged"):
                flagged_count += 1

            wd = ec - bc
            word_deltas.append(wd)
            if wd > 0.02:
                word_wins += 1
            elif wd < -0.02:
                word_losses += 1
            else:
                word_ties += 1

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

    # Quality tiers
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

    return {
        "sentences_evaluated": len(common_ids),
        "words_evaluated": total_words,
        "word_distribution": calc_dist(eval_word_confs),
        "sentence_distribution": calc_dist(eval_sent_confs),
        "quality_tiers": calc_tiers(eval_word_confs),
        "flagged_words_pct": round(flagged_count / max(1, total_words) * 100, 2),
        "paired_deltas": {
            "mean_word_delta": round(float(np.mean(word_deltas)), 4),
            "median_word_delta": round(float(np.median(word_deltas)), 4),
            "word_wins_pct": round(word_wins / max(1, total_words) * 100, 2),
            "word_ties_pct": round(word_ties / max(1, total_words) * 100, 2),
            "word_losses_pct": round(word_losses / max(1, total_words) * 100, 2),
            "mean_sent_delta": round(float(np.mean(sent_deltas)), 4),
            "median_sent_delta": round(float(np.median(sent_deltas)), 4),
            "sent_wins_pct": round(sent_wins / max(1, len(common_ids)) * 100, 2),
            "sent_ties_pct": round(sent_ties / max(1, len(common_ids)) * 100, 2),
            "sent_losses_pct": round(sent_losses / max(1, len(common_ids)) * 100, 2),
        },
        "raw_eval_words": eval_word_confs,
        "raw_word_deltas": word_deltas,
        "raw_eval_sents": eval_sent_confs,
    }


def plot_dashboard(
    base_dist: Dict[str, Any],
    base_words: List[float],
    base_sents: List[float],
    m7600_metrics: Dict[str, Any],
    m8000_metrics: Dict[str, Any],
    baseline_data: Dict[str, Dict[str, Any]],
    m7600_data: Dict[str, Any],
    m8000_data: Dict[str, Any],
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

    # Panel 1: Word Confidence Distribution (Density Histogram / Overlaid KDE)
    ax1 = axes[0, 0]
    bins = np.linspace(0, 1.0, 51)
    ax1.hist(base_words, bins=bins, alpha=0.45, density=True, color=BASELINE_COLOR, label=f"Baseline (med={np.median(base_words):.3f})")
    ax1.hist(m7600_metrics["raw_eval_words"], bins=bins, alpha=0.45, density=True, color=MODELS["checkpoint-7600"]["color"], label=f"Chkpt-7600 (med={np.median(m7600_metrics['raw_eval_words']):.3f})")
    ax1.hist(m8000_metrics["raw_eval_words"], bins=bins, alpha=0.45, density=True, color=MODELS["checkpoint-8000"]["color"], label=f"Chkpt-8000 (med={np.median(m8000_metrics['raw_eval_words']):.3f})")
    ax1.set_title("Word Confidence Distribution (Density)", fontsize=13, fontweight="bold")
    ax1.set_xlabel("Confidence Score (0.0 to 1.0)")
    ax1.set_ylabel("Probability Density")
    ax1.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc")
    ax1.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    # Panel 2: Quality Tiers Breakdown (Stacked Bar Chart)
    ax2 = axes[0, 1]
    tiers_labels = ["Baseline", "Chkpt-7600", "Chkpt-8000"]
    tier_high = [base_dist["quality_tiers"]["high_ge_80"], m7600_metrics["quality_tiers"]["high_ge_80"], m8000_metrics["quality_tiers"]["high_ge_80"]]
    tier_med = [base_dist["quality_tiers"]["medium_50_80"], m7600_metrics["quality_tiers"]["medium_50_80"], m8000_metrics["quality_tiers"]["medium_50_80"]]
    tier_low = [base_dist["quality_tiers"]["low_05_50"], m7600_metrics["quality_tiers"]["low_05_50"], m8000_metrics["quality_tiers"]["low_05_50"]]
    tier_fail = [base_dist["quality_tiers"]["failing_lt_05"], m7600_metrics["quality_tiers"]["failing_lt_05"], m8000_metrics["quality_tiers"]["failing_lt_05"]]

    x = np.arange(len(tiers_labels))
    w = 0.55
    ax2.bar(x, tier_high, w, label="High (≥80%)", color="#22c55e", alpha=0.9)
    ax2.bar(x, tier_med, w, bottom=tier_high, label="Medium (50–80%)", color="#eab308", alpha=0.9)
    ax2.bar(x, tier_low, w, bottom=[i+j for i, j in zip(tier_high, tier_med)], label="Low (5–50%)", color="#f97316", alpha=0.9)
    ax2.bar(x, tier_fail, w, bottom=[i+j+k for i, j, k in zip(tier_high, tier_med, tier_low)], label="Failing (<5%)", color="#ef4444", alpha=0.9)

    for i in range(len(tiers_labels)):
        ax2.text(i, tier_high[i] / 2, f"{tier_high[i]:.1f}%", ha="center", va="center", color="#0f172a", fontweight="bold", fontsize=10)

    ax2.set_xticks(x)
    ax2.set_xticklabels(tiers_labels, fontsize=11, fontweight="bold")
    ax2.set_title("Word Reliability Quality Tiers (%)", fontsize=13, fontweight="bold")
    ax2.set_ylabel("Percentage of Total Words")
    ax2.set_ylim(0, 105)
    ax2.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc", loc="lower right")
    ax2.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    # Panel 3: Paired Delta Distribution (Word-Level Shift from Baseline)
    ax3 = axes[1, 0]
    delta_bins = np.linspace(-0.5, 0.5, 51)
    ax3.hist(m7600_metrics["raw_word_deltas"], bins=delta_bins, alpha=0.55, color=MODELS["checkpoint-7600"]["color"], label=f"Chkpt-7600 Δ (mean={m7600_metrics['paired_deltas']['mean_word_delta']:+.3f})")
    ax3.hist(m8000_metrics["raw_word_deltas"], bins=delta_bins, alpha=0.55, color=MODELS["checkpoint-8000"]["color"], label=f"Chkpt-8000 Δ (mean={m8000_metrics['paired_deltas']['mean_word_delta']:+.3f})")
    ax3.axvline(0, color="#ffffff", linestyle="--", linewidth=1.5, alpha=0.7)
    ax3.set_title("Paired Word Confidence Shift (Δ = Model - Baseline)", fontsize=13, fontweight="bold")
    ax3.set_xlabel("Confidence Difference (Positive = Improvement)")
    ax3.set_ylabel("Word Count")
    ax3.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc")
    ax3.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    # Panel 4: Sentence Length vs. Confidence Stability (1 to 10+ words)
    ax4 = axes[1, 1]
    len_bins = [1, 2, 3, 4, 5, 6, 7, 8, 10, 20]
    len_labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9-10", "11+"]
    base_bin_confs = [[] for _ in range(len(len_labels))]
    m7600_bin_confs = [[] for _ in range(len(len_labels))]
    m8000_bin_confs = [[] for _ in range(len(len_labels))]

    common_ids = sorted(set(baseline_data.keys()) & set(m7600_data["sentences"].keys()) & set(m8000_data["sentences"].keys()))
    for sid in common_ids:
        b = baseline_data[sid]
        n_words = len(b.get("words", []))
        # Find bin
        b_idx = len(len_labels) - 1
        for idx_b in range(len(len_bins) - 1):
            if len_bins[idx_b] <= n_words < len_bins[idx_b + 1]:
                b_idx = idx_b
                break
        base_bin_confs[b_idx].append(b["mean_confidence"])
        m7600_bin_confs[b_idx].append(m7600_data["sentences"][sid]["mean_confidence"])
        m8000_bin_confs[b_idx].append(m8000_data["sentences"][sid]["mean_confidence"])

    x_len = np.arange(len(len_labels))
    base_means = [float(np.mean(b)) if b else 0.0 for b in base_bin_confs]
    m7600_means = [float(np.mean(b)) if b else 0.0 for b in m7600_bin_confs]
    m8000_means = [float(np.mean(b)) if b else 0.0 for b in m8000_bin_confs]

    ax4.plot(x_len, base_means, marker="o", linewidth=2.5, color=BASELINE_COLOR, label="Baseline")
    ax4.plot(x_len, m7600_means, marker="s", linewidth=2.5, color=MODELS["checkpoint-7600"]["color"], label="Chkpt-7600")
    ax4.plot(x_len, m8000_means, marker="^", linewidth=2.5, color=MODELS["checkpoint-8000"]["color"], label="Chkpt-8000")
    ax4.set_xticks(x_len)
    ax4.set_xticklabels(len_labels)
    ax4.set_title("Mean Sentence Confidence vs. Sentence Length (Words)", fontsize=13, fontweight="bold")
    ax4.set_xlabel("Sentence Word Count")
    ax4.set_ylabel("Mean Confidence")
    ax4.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc")
    ax4.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    plt.suptitle("Dictionary Benchmark (1975 Feeling, 1,857 Sentences): Baseline vs. Checkpoint-7600 vs. Checkpoint-8000", fontsize=15, fontweight="bold", color="#f8fafc", y=0.98)
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])

    out_fig = ARTIFACT_DIR / "dict_model_comparison_dashboard.png"
    plt.savefig(out_fig, dpi=200, bbox_inches="tight")
    logger.info("Saved dashboard figure to %s", out_fig)
    return out_fig


def main():
    parser = argparse.ArgumentParser(description="Benchmark dictionary alignment models")
    parser.add_argument("--device", default="mps" if torch.backends.mps.is_available() else "cpu", help="Compute device (mps, cpu, cuda)")
    args = parser.parse_args()

    token = load_token()
    valid_rows = load_valid_sentence_rows()
    baseline_data = load_baseline_data()

    # Calculate baseline distribution
    base_all_words: List[float] = []
    base_all_sents: List[float] = []
    for sid, p in baseline_data.items():
        base_all_sents.append(p["mean_confidence"])
        for w in p.get("words", []):
            base_all_words.append(w["confidence"])

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

    base_dist = {
        "word_distribution": calc_dist_simple(base_all_words),
        "sentence_distribution": calc_dist_simple(base_all_sents),
        "quality_tiers": calc_tiers_simple(base_all_words),
    }

    # Evaluate Chkpt-7600
    m7600_data = evaluate_model_on_dictionary(
        model_key="checkpoint-7600",
        repo=MODELS["checkpoint-7600"]["repo"],
        valid_rows=valid_rows,
        token=token,
        device=args.device,
    )
    m7600_metrics = compute_metrics(baseline_data, m7600_data)

    # Evaluate Chkpt-8000
    m8000_data = evaluate_model_on_dictionary(
        model_key="checkpoint-8000",
        repo=MODELS["checkpoint-8000"]["repo"],
        valid_rows=valid_rows,
        token=token,
        device=args.device,
    )
    m8000_metrics = compute_metrics(baseline_data, m8000_data)

    # Plot dashboard
    plot_dashboard(
        base_dist=base_dist,
        base_words=base_all_words,
        base_sents=base_all_sents,
        m7600_metrics=m7600_metrics,
        m8000_metrics=m8000_metrics,
        baseline_data=baseline_data,
        m7600_data=m7600_data,
        m8000_data=m8000_data,
    )

    # Remove raw list vectors before writing summary JSON
    m7600_summary = {k: v for k, v in m7600_metrics.items() if not k.startswith("raw_")}
    m8000_summary = {k: v for k, v in m8000_metrics.items() if not k.startswith("raw_")}

    summary_out = {
        "dataset": "Dictionary (1975 Feeling)",
        "sentences_count": len(valid_rows),
        "baseline": base_dist,
        "checkpoint-7600": m7600_summary,
        "checkpoint-8000": m8000_summary,
    }

    with open(ARTIFACT_DIR / "dict_models_comparison_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary_out, f, indent=2)

    logger.info("Saved comparison summary to %s", ARTIFACT_DIR / "dict_models_comparison_summary.json")
    print(json.dumps(summary_out, indent=2))


if __name__ == "__main__":
    main()
