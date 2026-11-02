#!/usr/bin/env python3
"""
scripts/generate_analysis_figures.py

Generates publication-quality figures for:
1. All three corpus sources: Sentence Length vs. Confidence (Dictionary, New Testament, Saving the Voices).
2. Side-by-side comparison of Cherokee New Testament confidences and syncope recovery before vs. after alignment adjustment.
"""

import json
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np

ARTIFACT_DIR = Path("/Users/julietmcvicker/.gemini/antigravity-cli/brain/6349a8b6-0ba2-4394-847c-f3a74cb51acc")
PHRASES_PATH = Path("/Users/julietmcvicker/code/digoliyetanidasdi/public/data/phrases.json")
OLD_NT_PATH = Path("/Users/julietmcvicker/code/workshop-transcription/data/projects/cherokee_new_testament/alignments/bible_alignment_records.backup.json")
NEW_NT_PATH = Path("/Users/julietmcvicker/code/workshop-transcription/data/projects/cherokee_new_testament/alignments/bible_alignment_records.json")

def generate_three_source_figure():
    with open(PHRASES_PATH, "r", encoding="utf-8") as f:
        phrases = json.load(f)

    dict_data = {"words": [], "chars": [], "conf": []}
    nt_data = {"words": [], "chars": [], "conf": []}
    stv_data = {"words": [], "chars": [], "conf": []}

    for p in phrases:
        src = p["source_id"]
        conf = p.get("mean_confidence")
        if conf is None or conf <= 0.0:
            continue

        w_cnt = len(p.get("words", []))
        c_cnt = len(p.get("phonetic_text", ""))
        if w_cnt == 0 or c_cnt == 0:
            continue

        if src.startswith("dict"):
            target = dict_data
        elif src.startswith("nt"):
            target = nt_data
        else:
            target = stv_data

        target["words"].append(w_cnt)
        target["chars"].append(c_cnt)
        target["conf"].append(conf)

    for d in (dict_data, nt_data, stv_data):
        d["words"] = np.array(d["words"])
        d["chars"] = np.array(d["chars"])
        d["conf"] = np.array(d["conf"])

    fig, axes = plt.subplots(1, 3, figsize=(18, 5.5), dpi=300)

    # 1. Word Count vs Confidence
    ax1 = axes[0]
    ax1.scatter(stv_data["words"], stv_data["conf"], alpha=0.15, s=10, color="#ff7f0e", label="Saving the Voices (N=13.8k)")
    ax1.scatter(nt_data["words"], nt_data["conf"], alpha=0.35, s=14, color="#1f77b4", label="New Testament (N=1.7k)")
    ax1.scatter(dict_data["words"], dict_data["conf"], alpha=0.5, s=18, color="#2ca02c", label="Dictionary 1975 (N=1.8k)")

    # Binned trend lines
    for data, color, name in [(dict_data, "#1b5e20", "Dict"), (nt_data, "#0d47a1", "NT"), (stv_data, "#e65100", "STV")]:
        max_w = min(40, int(np.percentile(data["words"], 98)))
        bins = np.arange(1, max_w + 1)
        bin_means = []
        valid_bins = []
        for b in bins:
            mask = data["words"] == b
            if np.sum(mask) >= 10:
                valid_bins.append(b)
                bin_means.append(np.mean(data["conf"][mask]))
        if valid_bins:
            ax1.plot(valid_bins, bin_means, color=color, linewidth=2.5, label=f"{name} Binned Mean")

    ax1.set_xlim(0, 45)
    ax1.set_ylim(-0.02, 1.05)
    ax1.set_xlabel("Phrase Length (Word Count)", fontsize=11, fontweight="bold")
    ax1.set_ylabel("Mean Alignment Confidence", fontsize=11, fontweight="bold")
    ax1.set_title("Phrase Word Count vs. Confidence by Source", fontsize=12, fontweight="bold")
    ax1.grid(True, linestyle="--", alpha=0.4)
    ax1.legend(loc="upper right", fontsize=8.5, framealpha=0.9)

    # 2. Character Count vs Confidence
    ax2 = axes[1]
    ax2.scatter(stv_data["chars"], stv_data["conf"], alpha=0.15, s=10, color="#ff7f0e", label="Saving the Voices")
    ax2.scatter(nt_data["chars"], nt_data["conf"], alpha=0.35, s=14, color="#1f77b4", label="New Testament")
    ax2.scatter(dict_data["chars"], dict_data["conf"], alpha=0.5, s=18, color="#2ca02c", label="Dictionary 1975")

    for data, color, name in [(dict_data, "#1b5e20", "Dict"), (nt_data, "#0d47a1", "NT"), (stv_data, "#e65100", "STV")]:
        max_c = min(350, int(np.percentile(data["chars"], 98)))
        step = 15
        bins = np.arange(0, max_c, step)
        bin_centers = []
        bin_means = []
        for i in range(len(bins) - 1):
            mask = (data["chars"] >= bins[i]) & (data["chars"] < bins[i+1])
            if np.sum(mask) >= 10:
                bin_centers.append((bins[i] + bins[i+1]) / 2)
                bin_means.append(np.mean(data["conf"][mask]))
        if bin_centers:
            ax2.plot(bin_centers, bin_means, color=color, linewidth=2.5, label=f"{name} Trend")

    ax2.set_xlim(0, 360)
    ax2.set_ylim(-0.02, 1.05)
    ax2.set_xlabel("Phrase Length (Character Count)", fontsize=11, fontweight="bold")
    ax2.set_ylabel("Mean Alignment Confidence", fontsize=11, fontweight="bold")
    ax2.set_title("Character Count vs. Confidence by Source", fontsize=12, fontweight="bold")
    ax2.grid(True, linestyle="--", alpha=0.4)
    ax2.legend(loc="upper right", fontsize=8.5, framealpha=0.9)

    # 3. Confidence Distribution Boxplot & Medians
    ax3 = axes[2]
    source_labels = ["Dictionary 1975\n(Clean / Studio)", "New Testament\n(Narrated Bible)", "Saving Voices\n(Conversational)"]
    box_data = [dict_data["conf"], nt_data["conf"], stv_data["conf"]]
    colors = ["#2ca02c", "#1f77b4", "#ff7f0e"]

    bplot = ax3.boxplot(box_data, patch_artist=True, tick_labels=source_labels, widths=0.55,
                        medianprops=dict(color="black", linewidth=2),
                        flierprops=dict(marker="o", markersize=3, alpha=0.2))

    for patch, col in zip(bplot["boxes"], colors):
        patch.set_facecolor(col)
        patch.set_alpha(0.65)

    # Annotate medians and means
    for idx, d in enumerate(box_data, start=1):
        mean_v = np.mean(d)
        med_v = np.median(d)
        ax3.plot(idx, mean_v, marker="D", color="red", markersize=6, label="Mean" if idx == 1 else "")
        ax3.text(idx + 0.3, med_v, f"Med: {med_v:.2f}\nMean: {mean_v:.2f}",
                 verticalalignment="center", fontsize=9, fontweight="semibold")

    ax3.set_ylim(-0.02, 1.05)
    ax3.set_ylabel("Alignment Confidence Score", fontsize=11, fontweight="bold")
    ax3.set_title("Corpus Confidence Distribution by Source", fontsize=12, fontweight="bold")
    ax3.grid(True, linestyle="--", alpha=0.4)
    ax3.legend(loc="lower left", fontsize=9)

    plt.tight_layout()
    out_file = ARTIFACT_DIR / "corpus_sentence_length_vs_confidence.png"
    plt.savefig(out_file, dpi=300)
    plt.close()
    print(f"Generated three-source graphic: {out_file}")


def generate_nt_adjustment_comparison():
    with open(OLD_NT_PATH, "r", encoding="utf-8") as f:
        old_records = {r["verse_id"]: r for r in json.load(f)}
    with open(NEW_NT_PATH, "r", encoding="utf-8") as f:
        new_records = {r["verse_id"]: r for r in json.load(f)}

    common_ids = sorted(set(old_records.keys()) & set(new_records.keys()))

    # True verse word-level confidences
    old_verse_confs = []
    new_verse_confs = []
    verse_word_lens = []

    # nahski tracking
    old_nahski_total = 0
    old_nhski_count = 0
    new_nahski_total = 0
    new_nhski_count = 0

    for vid in common_ids:
        o = old_records[vid]
        n = new_records[vid]

        o_words = o.get("words", [])
        n_words = n.get("words", [])

        o_wconfs = [w["confidence"] for w in o_words if w.get("confidence") is not None]
        n_wconfs = [w["confidence"] for w in n_words if w.get("confidence") is not None]

        old_verse_confs.append(np.mean(o_wconfs) if o_wconfs else 0.0)
        new_verse_confs.append(np.mean(n_wconfs) if n_wconfs else 0.0)
        verse_word_lens.append(len(n_words))

        for w in o_words:
            if w.get("word") == "nahski":
                old_nahski_total += 1
                if w.get("emitted_word") == "nhski":
                    old_nhski_count += 1

        for w in n_words:
            if w.get("word") == "nahski":
                new_nahski_total += 1
                if w.get("emitted_word") == "nhski":
                    new_nhski_count += 1

    old_verse_confs = np.array(old_verse_confs)
    new_verse_confs = np.array(new_verse_confs)
    deltas = new_verse_confs - old_verse_confs
    verse_word_lens = np.array(verse_word_lens)

    fig, axes = plt.subplots(2, 2, figsize=(15, 12), dpi=300)

    # Subplot 1: Paired Scatter (Old vs New Verse Word Confidence)
    ax1 = axes[0, 0]
    scatter = ax1.scatter(old_verse_confs, new_verse_confs, c=deltas, cmap="coolwarm_r", s=22, alpha=0.6, edgecolors="none")
    ax1.plot([0, 1], [0, 1], "k--", linewidth=1.5, label="y = x (No change)")
    cbar = plt.colorbar(scatter, ax=ax1)
    cbar.set_label("Delta (New - Old)", fontsize=10)
    ax1.set_xlim(0.15, 1.0)
    ax1.set_ylim(0.15, 1.0)
    ax1.set_xlabel("Old Alignment Verse Word Confidence", fontsize=11, fontweight="bold")
    ax1.set_ylabel("New Alignment Verse Word Confidence", fontsize=11, fontweight="bold")
    ax1.set_title("New Testament Verse Confidence: Old vs. New", fontsize=12, fontweight="bold")
    ax1.grid(True, linestyle="--", alpha=0.4)
    ax1.legend(loc="upper left")

    # Subplot 2: Delta Distribution (New - Old)
    ax2 = axes[0, 1]
    n_bins, bins, patches = ax2.hist(deltas, bins=45, color="#1f77b4", edgecolor="black", alpha=0.7)
    mean_d = np.mean(deltas)
    med_d = np.median(deltas)
    ax2.axvline(0.0, color="black", linestyle="--", linewidth=1.5, label="Zero Delta")
    ax2.axvline(mean_d, color="red", linestyle="-", linewidth=2.0, label=f"Mean Delta ({mean_d:+.3f})")
    ax2.axvline(med_d, color="green", linestyle=":", linewidth=2.0, label=f"Median Delta ({med_d:+.3f})")
    ax2.set_xlabel("Confidence Difference (New - Old)", fontsize=11, fontweight="bold")
    ax2.set_ylabel("Number of Bible Verses", fontsize=11, fontweight="bold")
    ax2.set_title("Distribution of Verse Confidence Changes", fontsize=12, fontweight="bold")
    ax2.grid(True, linestyle="--", alpha=0.4)
    ax2.legend(loc="upper left")

    # Subplot 3: Side-by-Side Confidence Distributions (KDE / Histogram overlay)
    ax3 = axes[1, 0]
    ax3.hist(old_verse_confs, bins=35, alpha=0.45, color="#e41a1c", label=f"Old Alignment (Mean={np.mean(old_verse_confs):.3f})", edgecolor="#b30000")
    ax3.hist(new_verse_confs, bins=35, alpha=0.55, color="#377eb8", label=f"New Alignment (Mean={np.mean(new_verse_confs):.3f})", edgecolor="#08519c")
    ax3.set_xlabel("Verse Word-Level Confidence", fontsize=11, fontweight="bold")
    ax3.set_ylabel("Number of Verses", fontsize=11, fontweight="bold")
    ax3.set_title("Confidence Distribution Shift (Old vs. New)", fontsize=12, fontweight="bold")
    ax3.grid(True, linestyle="--", alpha=0.4)
    ax3.legend(loc="upper left")

    # Subplot 4: Syncope Restoration Breakdown (nahski vs nhski)
    ax4 = axes[1, 1]
    categories = ["Old Alignment\n(Unconstrained Syncope)", "New Alignment\n(Blank-Gated Syncope)"]
    collapsed = [old_nhski_count, new_nhski_count]
    retained = [old_nahski_total - old_nhski_count, new_nahski_total - new_nhski_count]

    x = np.arange(len(categories))
    width = 0.45
    p1 = ax4.bar(x, retained, width, label="Canonical 'nahski' Retained", color="#2ca02c", alpha=0.85, edgecolor="black")
    p2 = ax4.bar(x, collapsed, width, bottom=retained, label="False 'nhski' Collapsed", color="#d62728", alpha=0.85, edgecolor="black")

    ax4.set_ylabel("Total Occurrences of 'nahski'", fontsize=11, fontweight="bold")
    ax4.set_title("Vocalic Syncope Recovery: 'nahski' vs. 'nhski'", fontsize=12, fontweight="bold")
    ax4.set_xticks(x)
    ax4.set_xticklabels(categories, fontsize=10, fontweight="bold")
    ax4.set_ylim(0, max(old_nahski_total, new_nahski_total) * 1.15)
    ax4.grid(True, linestyle="--", alpha=0.4, axis="y")
    ax4.legend(loc="upper right")

    # Add bar percentage annotations
    for i in range(len(categories)):
        tot = retained[i] + collapsed[i]
        ret_pct = retained[i] / tot * 100
        col_pct = collapsed[i] / tot * 100
        ax4.text(x[i], retained[i] / 2, f"{retained[i]}\n({ret_pct:.1f}%)", ha="center", va="center", color="white", fontweight="bold", fontsize=11)
        ax4.text(x[i], retained[i] + collapsed[i] / 2, f"{collapsed[i]}\n({col_pct:.1f}%)", ha="center", va="center", color="white", fontweight="bold", fontsize=11)

    plt.tight_layout()
    out_file = ARTIFACT_DIR / "nt_confidence_shift_side_by_side.png"
    plt.savefig(out_file, dpi=300)
    plt.close()
    print(f"Generated side-by-side NT adjustment comparison: {out_file}")

if __name__ == "__main__":
    generate_three_source_figure()
    generate_nt_adjustment_comparison()
