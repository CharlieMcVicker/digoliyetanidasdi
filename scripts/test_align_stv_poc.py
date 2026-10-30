#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/test_align_stv_poc.py

Unit tests for the Saving the Voices PoC alignment pipeline:
- Syllabary diacritic cleaning (preserving compound clitics and stutter hyphens)
- Laughter heuristic (dropping ᎤᏰᏣᏍᎦ/ᎤᏂᏰᏣᏍᎦ when English has [laughter])
- Clause splitting on ?, !, ... without breaking inline syllabary periods
- Acoustic pause phrase partitioning
"""

from __future__ import annotations

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from align_stv_poc import (
    clean_cherokee_syllabary_tokens,
    filter_laughter_and_stage_directions,
    partition_words_into_phrases,
    prepare_turn_clauses,
)
from digohwelisgi.core.alignment.models import WordInterval


class TestSTVPocAlignment(unittest.TestCase):
    def test_clean_syllabary_diacritics(self) -> None:
        raw = "ᎤᎾ,ᎴᏅᎲ ᏓᏃᏢᏍᎬ ᏓᏂᏂ,ᏕᎬ Ꮳ.Ꮧ? ᎪᎱ:ᏍᏗ Bell-Ꭲ ᎤᏥ;ᏈᏗ"
        cleaned = clean_cherokee_syllabary_tokens(raw)
        self.assertEqual(cleaned, "ᎤᎾᎴᏅᎲ ᏓᏃᏢᏍᎬ ᏓᏂᏂᏕᎬ ᏣᏗ ᎪᎱᏍᏗ Bell-Ꭲ ᎤᏥᏈᏗ")

    def test_stutter_repair_hyphens_split(self) -> None:
        raw = "ᎠᏂᏗᎰ--ᎠᏂᏕᎮ Ꮷ-ᏧᎶᏒ"
        cleaned = clean_cherokee_syllabary_tokens(raw)
        self.assertEqual(cleaned, "ᎠᏂᏗᎰ ᎠᏂᏕᎮ Ꮷ ᏧᎶᏒ")

    def test_laughter_filtering_with_english_tag(self) -> None:
        chr_text = "ᎯᎠ ᎤᏰᏣᏍᎦ Ꮎ ᏂᎦᎵᏍᏗ"
        en_text = "[laughter] This is happening"
        filtered = filter_laughter_and_stage_directions(chr_text, en_text)
        self.assertEqual(filtered, "ᎯᎠ Ꮎ ᏂᎦᎵᏍᏗ")

        # Plural variant ᎤᏂᏰᏣᏍᎦ
        chr_text_plural = "ᏂᎦᏓ ᎤᏂᏰᏣᏍᎦ ᎾᎿ"
        en_text_plural = "They were all [laughs] there"
        filtered_pl = filter_laughter_and_stage_directions(chr_text_plural, en_text_plural)
        self.assertEqual(filtered_pl, "ᏂᎦᏓ ᎾᎿ")

    def test_laughter_filtering_bracketed_stage_directions(self) -> None:
        # Bracketed Cherokee laughter stage direction should drop even without English tag
        chr_text = "ᎾᏍᎩ (ᎤᏰᏥ,ᏍᎦ) ᏄᏪᏒ"
        en_text = "That is what he said"
        filtered = filter_laughter_and_stage_directions(chr_text, en_text)
        self.assertEqual(filtered, "ᎾᏍᎩ ᏄᏪᏒ")

    def test_prepare_turn_clauses_preserves_internal_periods(self) -> None:
        # Period inside Ꮳ.Ꮧ must NOT cause a clause split; only ? and ! split
        raw = "Ꮎ bridge Ꮩ ᎤᏍᏗ ᏴᏓ ᏣᎳᎩ ᎬᏗ? ᎠᏂᏒᏢᏗᏍᎬ! Ꮳ.Ꮧ ᎨᎮ."
        clauses = prepare_turn_clauses(raw, "What was the bridge called? Building bridges! It was called...")
        self.assertEqual(len(clauses), 3)
        # First clause ends at ?
        self.assertTrue("bridge" in clauses[0][1] and "ᎬᏗ" in clauses[0][1])
        # Second clause ends at !
        self.assertEqual(clauses[1][1], "ᎠᏂᏒᏢᏗᏍᎬ")
        # Third clause has the rest, with internal period in Ꮳ.Ꮧ stripped to ᏣᏗ
        self.assertEqual(clauses[2][1], "ᏣᏗ ᎨᎮ")

    def test_partition_words_into_phrases(self) -> None:
        words = [
            WordInterval(word="word1", start_sec=0.0, end_sec=4.0),
            WordInterval(word="word2", start_sec=4.2, end_sec=8.0),
            WordInterval(word="word3", start_sec=8.1, end_sec=12.0),
            # Large 2.0s acoustic gap between word3 and word4
            WordInterval(word="word4", start_sec=14.0, end_sec=18.0),
            WordInterval(word="word5", start_sec=18.2, end_sec=22.0),
        ]
        syl_words = ["w1", "w2", "w3", "w4", "w5"]
        phrases = partition_words_into_phrases(words, syl_words, max_duration_sec=15.0)
        self.assertEqual(len(phrases), 2)
        # Left phrase has 3 words (0.0s - 12.0s <= 15s)
        self.assertEqual(len(phrases[0][0]), 3)
        self.assertEqual(phrases[0][1], ["w1", "w2", "w3"])
        # Right phrase has 2 words (14.0s - 22.0s <= 15s)
        self.assertEqual(len(phrases[1][0]), 2)
        self.assertEqual(phrases[1][1], ["w4", "w5"])


if __name__ == "__main__":
    unittest.main()
