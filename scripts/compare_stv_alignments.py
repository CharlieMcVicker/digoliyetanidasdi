#!/usr/bin/env python3
"""
scripts/compare_stv_alignments.py

Performs comprehensive comparative analysis between:
- data/saving-the-voices/alignments_backup/ (Unconstrained syncope)
- data/saving-the-voices/alignments/ (Blank-constrained syncope)

Generates:
1. Detailed statistics: word count, confidence distributions, syncopated token shifts.
2. Side-by-side 4-panel visual comparison: stv_confidence_shift_side_by_side.png.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

matplotlib.rcParams['font.sans-serif'] = ['Noto Sans Cherokee', 'Plantagenet Cherokee', 'DejaVu Sans', 'Arial']
matplotlib.rcParams['font.family'] = 'sans-serif'

BACKUP_DIR = Path("data/saving-the-voices/alignments_backup")
CURRENT_DIR = Path("data/saving-the-voices/alignments")
ARTIFACT_DIR = Path("/Users/julietmcvicker/.gemini/antigravity-cli/brain/6349a8b6-0ba2-4394-847c-f3a74cb51acc")


def load_all_alignments(d: Path) -> Dict[str, Dict[str, Any]]:
    results = {}
    for p in sorted(d.glob("*_aligned.json")):
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            results[p.stem.replace("_aligned", "")] = data
    return results


def analyze():
    print("Loading backup and current STV alignments...")
    old_data = load_all_alignments(BACKUP_DIR)
    new_data = load_all_alignments(CURRENT_DIR)

    common_interviews = sorted(set(old_data.keys()) & set(new_data.keys()))
    print(f"Loaded {len(common_interviews)} common interviews.")

    old_all_confs: List[float] = []
    new_all_confs: List[float] = []

    old_phrases_count = 0
    new_phrases_count = 0

    interview_metrics = []

    # Target frequent colloquial/syncopated tokens in Saving the Voices
    target_tokens = ["skina", "skwu", "kehv", "ohsta", "tsikehv", "yuhsti", "na", "ski"]
    old_target_confs: Dict[str, List[float]] = {t: [] for t in target_tokens}
    new_target_confs: Dict[str, List[float]] = {t: [] for t in target_tokens}

    old_durations: List[float] = []
    old_phrase_confs: List[float] = []
    new_durations: List[float] = []
    new_phrase_confs: List[float] = []

    for name in common_interviews:
        old_inv = old_data[name]
        new_inv = new_data[name]

        old_phrases = old_inv.get("phrases", [])
        new_phrases = new_inv.get("phrases", [])
        old_phrases_count += len(old_phrases)
        new_phrases_count += len(new_phrases)

        old_confs = []
        for p in old_phrases:
            old_durations.append(p.get("duration_sec", 0.0))
            old_phrase_confs.append(p.get("mean_confidence", 0.0))
            for w in p.get("words", []):
                c = w.get("confidence", 0.0)
                old_all_confs.append(c)
                old_confs.append(c)
                word_clean = w.get("word", "").lower()
                if word_clean in old_target_confs:
                    old_target_confs[word_clean].append(c)

        new_confs = []
        for p in new_phrases:
            new_durations.append(p.get("duration_sec", 0.0))
            new_phrase_confs.append(p.get("mean_confidence", 0.0))
            for w in p.get("words", []):
                c = w.get("confidence", 0.0)
                new_all_confs.append(c)
                new_confs.append(c)
                word_clean = w.get("word", "").lower()
                if word_clean in new_target_confs:
                    new_target_confs[word_clean].append(c)

        old_m = float(np.mean(old_confs)) if old_confs else 0.0
        new_m = float(np.mean(new_confs)) if new_confs else 0.0
        interview_metrics.append({
            "name": name,
            "old_mean": old_m,
            "new_mean": new_m,
            "delta": new_m - old_m,
            "old_phrases": len(old_phrases),
            "new_phrases": len(new_phrases),
        })

    print(f"Total old phrases: {old_phrases_count}, Total new phrases: {new_phrases_count}")
    print(f"Total old word tokens: {len(old_all_confs):,}, Total new word tokens: {len(new_all_confs):,}")
    print(f"Old mean word confidence: {np.mean(old_all_confs):.4f} (median {np.median(old_all_confs):.4f})")
    print(f"New mean word confidence: {np.mean(new_all_confs):.4f} (median {np.median(new_all_confs):.4f})")
    print(f"Confidence shift delta: {np.mean(new_all_confs) - np.mean(old_all_confs):+.4f}")

    # Plot 4-panel comparison figure
    fig, axes = plt.subplots(2, 2, figsize=(15, 11))
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

    # Panel 1: Confidence distribution histograms
    ax1 = axes[0, 0]
    bins = np.linspace(0, 1, 51)
    ax1.hist(old_all_confs, bins=bins, alpha=0.55, color="#f43f5e", density=True, label=f"Old (Unconstrained, mean={np.mean(old_all_confs):.3f})")
    ax1.hist(new_all_confs, bins=bins, alpha=0.55, color="#38bdf8", density=True, label=f"New (Blank-Constrained, mean={np.mean(new_all_confs):.3f})")
    ax1.set_title("Overall Word Confidence Distribution (Density)", fontsize=13, fontweight="bold")
    ax1.set_xlabel("Confidence Score (0.0 to 1.0)")
    ax1.set_ylabel("Density")
    ax1.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc")
    ax1.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    # Panel 2: Per-interview mean confidence comparison
    ax2 = axes[0, 1]
    short_names = [m["name"].replace("stv_", "").replace("_aligned", "") for m in interview_metrics]
    # Keep only numbers/short tags for readability
    short_labels = [s.split("_")[0] for s in short_names]
    x = np.arange(len(interview_metrics))
    width = 0.38
    old_means = [m["old_mean"] for m in interview_metrics]
    new_means = [m["new_mean"] for m in interview_metrics]
    ax2.bar(x - width/2, old_means, width, label="Old Syncope", color="#f43f5e", alpha=0.8)
    ax2.bar(x + width/2, new_means, width, label="Blank-Constrained", color="#38bdf8", alpha=0.8)
    ax2.set_xticks(x)
    ax2.set_xticklabels(short_labels, rotation=45, fontsize=8)
    ax2.set_title("Mean Word Confidence by Interview (22 Interviews)", fontsize=13, fontweight="bold")
    ax2.set_xlabel("Interview ID")
    ax2.set_ylabel("Mean Confidence")
    ax2.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc")
    ax2.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    # Panel 3: Syncopated word group shifts
    ax3 = axes[1, 0]
    token_groups = [
        ("skina (ᏍᎩᎾ)", old_target_confs["skina"], new_target_confs["skina"]),
        ("skwu (ᏍᏊ)", old_target_confs["skwu"], new_target_confs["skwu"]),
        ("kehv (ᎨᎲ)", old_target_confs["kehv"], new_target_confs["kehv"]),
        ("ohsta (ᎣᏍᏓ)", old_target_confs["ohsta"], new_target_confs["ohsta"]),
        ("tsikehv (ᏥᎨᎲ)", old_target_confs["tsikehv"], new_target_confs["tsikehv"]),
        ("yuhsti (ᏳᏍᏗ)", old_target_confs["yuhsti"], new_target_confs["yuhsti"]),
        ("na (Ꮎ)", old_target_confs["na"], new_target_confs["na"]),
        ("ski (ᏍᎩ)", old_target_confs["ski"], new_target_confs["ski"]),
    ]
    t_labels = [g[0] for g in token_groups]
    t_old_means = [float(np.mean(g[1])) if g[1] else 0.0 for g in token_groups]
    t_new_means = [float(np.mean(g[2])) if g[2] else 0.0 for g in token_groups]
    t_old_counts = [len(g[1]) for g in token_groups]
    t_new_counts = [len(g[2]) for g in token_groups]

    x_t = np.arange(len(token_groups))
    ax3.bar(x_t - width/2, t_old_means, width, label="Old Syncope", color="#fb7185", alpha=0.85)
    ax3.bar(x_t + width/2, t_new_means, width, label="Blank-Constrained", color="#2dd4bf", alpha=0.85)
    for i in range(len(token_groups)):
        ax3.text(i - width/2, t_old_means[i] + 0.015, f"n={t_old_counts[i]}", ha='center', va='bottom', fontsize=8, color="#cbd5e1")
        ax3.text(i + width/2, t_new_means[i] + 0.015, f"n={t_new_counts[i]}", ha='center', va='bottom', fontsize=8, color="#cbd5e1")
    ax3.set_xticks(x_t)
    ax3.set_xticklabels(t_labels, rotation=15, fontsize=9)
    ax3.set_title("Target Syncopated Token Confidence & Counts", fontsize=13, fontweight="bold")
    ax3.set_ylabel("Mean Confidence")
    ax3.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc")
    ax3.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")
    ax3.set_ylim(0, max(max(t_old_means), max(t_new_means)) * 1.25)

    # Panel 4: Duration vs Confidence hexbin / scatter summary
    ax4 = axes[1, 1]
    # Boxplot of phrase confidences by duration quintile
    dur_bins = [0, 3, 6, 9, 12, 30]
    dur_labels = ["0-3s", "3-6s", "6-9s", "9-12s", "12s+"]
    old_binned = [[] for _ in range(5)]
    new_binned = [[] for _ in range(5)]
    for d, c in zip(old_durations, old_phrase_confs):
        for bi in range(5):
            if dur_bins[bi] <= d < dur_bins[bi+1]:
                old_binned[bi].append(c)
                break
    for d, c in zip(new_durations, new_phrase_confs):
        for bi in range(5):
            if dur_bins[bi] <= d < dur_bins[bi+1]:
                new_binned[bi].append(c)
                break

    x_b = np.arange(5)
    old_b_means = [float(np.mean(b)) if b else 0.0 for b in old_binned]
    new_b_means = [float(np.mean(b)) if b else 0.0 for b in new_binned]
    ax4.plot(x_b, old_b_means, marker="o", linewidth=2.5, color="#f43f5e", label=f"Old Syncope (mean={np.mean(old_phrase_confs):.3f})")
    ax4.plot(x_b, new_b_means, marker="s", linewidth=2.5, color="#38bdf8", label=f"Blank-Constrained (mean={np.mean(new_phrase_confs):.3f})")
    ax4.set_xticks(x_b)
    ax4.set_xticklabels(dur_labels)
    ax4.set_title("Phrase Confidence vs Duration Bins", fontsize=13, fontweight="bold")
    ax4.set_xlabel("Phrase Audio Duration (seconds)")
    ax4.set_ylabel("Mean Confidence")
    ax4.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc")
    ax4.grid(True, linestyle="--", alpha=0.2, color="#94a3b8")

    plt.suptitle("Saving the Voices Realignment Analysis: Unconstrained vs Blank-Constrained Syncope", fontsize=16, fontweight="bold", color="#f8fafc", y=0.98)
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])

    out_path = ARTIFACT_DIR / "stv_confidence_shift_side_by_side.png"
    plt.savefig(out_path, dpi=200, bbox_inches="tight")
    print(f"Saved figure to: {out_path}")

    # Output detailed JSON metrics summary for report
    summary = {
        "interviews_count": len(common_interviews),
        "old_total_phrases": old_phrases_count,
        "new_total_phrases": new_phrases_count,
        "old_total_words": len(old_all_confs),
        "new_total_words": len(new_all_confs),
        "old_mean_conf": round(float(np.mean(old_all_confs)), 4),
        "new_mean_conf": round(float(np.mean(new_all_confs)), 4),
        "old_median_conf": round(float(np.median(old_all_confs)), 4),
        "new_median_conf": round(float(np.median(new_all_confs)), 4),
        "conf_delta": round(float(np.mean(new_all_confs) - np.mean(old_all_confs)), 4),
        "token_groups": {
            t_labels[i]: {
                "old_mean": round(t_old_means[i], 4),
                "new_mean": round(t_new_means[i], 4),
                "old_count": t_old_counts[i],
                "new_count": t_new_counts[i],
            }
            for i in range(len(token_groups))
        },
    }
    with open(ARTIFACT_DIR / "stv_comparison_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    print("Saved summary JSON to artifact dir.")


if __name__ == "__main__":
    analyze()
