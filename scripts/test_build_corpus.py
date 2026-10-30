#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/test_build_corpus.py

Unit tests for marked-up syllabary-to-T/TH conversion and Saving the Voices
corpus ingestion in scripts/build_corpus.py.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_corpus import convert_marked_segment, convert_marked_token


class TestMarkedSyllabaryConversion(unittest.TestCase):
    def test_internal_comma_syncope(self) -> None:
        self.assertEqual(
            convert_marked_token("ᎤᎵ,ᏍᏔᏂᏙᎴ"),
            [("ᎤᎵᏍᏔᏂᏙᎴ", "ulsthanitole")],
        )
        self.assertEqual(
            convert_marked_token("ᏚᎵ,ᏍᏆᎵ,Ꮢ"),
            [("ᏚᎵᏍᏆᎵᏒ", "tulskwalsv")],
        )

    def test_word_final_comma_apocope(self) -> None:
        self.assertEqual(
            convert_marked_token("ᎠᏂᏲᏁᎦ,"),
            [("ᎠᏂᏲᏁᎦ", "aniyonek")],
        )
        self.assertEqual(
            convert_marked_token("ᎬᏗ,?"),
            [("ᎬᏗ", "kvt")],
        )

    def test_semicolon_drop_vowel_and_add_h(self) -> None:
        self.assertEqual(
            convert_marked_token("ᎤᏥ;ᏈᏗ"),
            [("ᎤᏥᏈᏗ", "utshkwiti")],
        )
        self.assertEqual(
            convert_marked_token("ᏧᎾᏁᎵ;ᏙᏗ"),
            [("ᏧᎾᏁᎵᏙᏗ", "tsunanelhtoti")],
        )
        self.assertEqual(
            convert_marked_token("ᏂᏛᎩᎶᏒ;"),
            [("ᏂᏛᎩᎶᏒ", "nitvkilohsh")],
        )

    def test_internal_period_coda_aspiration(self) -> None:
        self.assertEqual(
            convert_marked_token("ᏣᏛ.ᏏᏙᎸ?"),
            [("ᏣᏛᏏᏙᎸ", "tsatvhsitolv")],
        )
        self.assertEqual(
            convert_marked_token("ᎠᏩ,Ꮫ.ᏓᏍᏗ"),
            [("ᎠᏩᏛᏓᏍᏗ", "awtvhtahsti")],
        )

    def test_internal_colon_long_vowel_stripped(self) -> None:
        self.assertEqual(
            convert_marked_token("ᎪᎱ:ᏍᏗ"),
            [("ᎪᎱᏍᏗ", "kohuhsti")],
        )

    def test_apostrophes_glottal_and_apheresis(self) -> None:
        self.assertEqual(
            convert_marked_token("ᏧᎾᏕᎶᏆᏍᏗ’Ꭱ"),
            [("ᏧᎾᏕᎶᏆᏍᏗᎡ", "tsunatelokwahsti'e")],
        )
        self.assertEqual(
            convert_marked_token("ᎤᏨᏘᏅ’Ꮲ"),
            [("ᎤᏨᏘᏅᏢ", "utsvthinv'tlv")],
        )
        self.assertEqual(
            convert_marked_token("‘Ꮩ"),
            [("Ꮩ", "to")],
        )
        self.assertEqual(
            convert_marked_token("Ꮩ’."),
            [("Ꮩ", "to'")],
        )

    def test_stutter_repair_and_ellipsis_split_into_words(self) -> None:
        self.assertEqual(
            convert_marked_token("Ꮷ-ᏧᎶᏒ"),
            [("Ꮷ", "tsu"), ("ᏧᎶᏒ", "tsulohsv")],
        )
        self.assertEqual(
            convert_marked_token("ᎠᏂᏗᎰ--ᎠᏂᏕᎮ"),
            [("ᎠᏂᏗᎰ", "anitiho"), ("ᎠᏂᏕᎮ", "anitehe")],
        )
        self.assertEqual(
            convert_marked_token("ᏥᏄᎵ,ᏍᏔᏅ...ᏥᏐᎯ"),
            [("ᏥᏄᎵᏍᏔᏅ", "tsinulsthanv"), ("ᏥᏐᎯ", "tsihsohi")],
        )

    def test_compound_clitic_and_parenthetical(self) -> None:
        self.assertEqual(
            convert_marked_token("‘truck’Ꭲ"),
            [("truckᎢ", "truck'i")],
        )
        self.assertEqual(
            convert_marked_token("Bell-Ꭲ"),
            [("BellᎢ", "bell'i")],
        )
        self.assertEqual(
            convert_marked_token("ᏥᏛ(Ꭹ)ᏓᏁᎸ"),
            [("ᏥᏛᎩᏓᏁᎸ", "tsitvkitanelv")],
        )

    def test_full_segment_1_to_1_alignment(self) -> None:
        raw = "Mhm. Huh. ‘Ꮩ ᎤᎵ,ᏍᏔᏂᏙᎴ ‘truck’Ꭲ ᏥᏣ,ᏐᏁ?"
        syl, phon, words = convert_marked_segment(raw)
        self.assertEqual(syl, "Mhm Huh Ꮩ ᎤᎵᏍᏔᏂᏙᎴ truckᎢ ᏥᏣᏐᏁ")
        self.assertEqual(phon, "mhm huh to ulsthanitole truck'i tsitssone")
        self.assertEqual(len(syl.split()), len(words))


if __name__ == "__main__":
    unittest.main()
