# Digoliyetanidasdi (ᏗᎪᎵᏰᏔᏂᏓᏍᏗ)

**Digoliyetanidasdi** is a Cherokee audio search engine and aligned corpus browser connecting written Cherokee (Sequoyan syllabary and romanized phonetics) and English translations directly to spoken audio recordings with word-level timestamps.

---

## 1. Overview & Collections

The application indexes three major Cherokee audio collections:

1. **1975 Durbin Feeling Cherokee-English Dictionary** (`dictionary_collection`)
   - Studio recordings of headwords and illustrative sentences.
2. **Cherokee New Testament** (`biblical_chapter`)
   - Chapter-level readings aligned at the verse and word level.
3. **Saving the Voices (ᎠᏂᏬᏂᏍᎩ ᎤᏂᏍᏆᏂᎪᏛᎢ)** (`marked_syllabary_corpus`)
   - Spontaneous, unscripted interviews with fluent Cherokee elders recorded in Oklahoma communities.
   - Pre-sliced into 5–15 second phrase WAVs at natural acoustic pauses and word-aligned using CTC forced alignment.

---

## 2. Search & Orthographic Systems

The frontend (`src/App.tsx`, `src/lib/search.ts`) provides three search boxes tailored for community learners, speakers, and linguists:

| Search Box | Label in UI | Orthography / Behavior | Example |
|---|---|---|---|
| **Box 1** | **1. Standard Spelling (d/t)** | Durbin Feeling / Websterian (`d`, `g`, `j`, `ch`, optional tone/length diacritics). Automatically normalized at search time to linguistic T/TH. | `anichuja`, `adalenisgv`, `gadu` |
| **Box 2** | **2. Linguistic Spelling (t/th)** | Pike-Smalley / Pre-Bible (`t`, `th`, `k`, `kh`, `ts`, `tsh`). Includes an automatic broad fallback (stripping `h` and glottal stops `'`). | `anitshutsa`, `atalenihskv`, `katu` |
| **Box 3** | **3. English Meaning** | Prefix, token, and substring search over English translations. | `playing ball`, `roosters` |

---

## 3. Acoustic Forced Alignment Pipeline

### Model & Architecture
- **Acoustic Model**: `charliemcvicker/length-only-20260704-155307-asr-cherokee-colon` (Wav2Vec2-CTC trained on historical Cherokee recordings prior to modern orthographic shifts).
- **Voice Activity Detection (VAD)**: Silero VAD soft-masking (`vad_p_low=0.15`, `vad_p_high=0.60`, `vad_pad_ms=60`) dampens non-speech pauses before CTC trellis alignment.

### Conversational Cherokee Phonetics
Natural spoken Cherokee differs significantly from slow citation speech. Our alignment pipeline (`scripts/align_stv_poc.py` and `digohwelisgi`) handles:
1. **Syncope (Vowel Dropping)**: Unstressed short vowels frequently drop in conversational speech. The CTC segmentation trellis accommodates syncopated syllables without losing word boundaries.
2. **Intrusions (`h` and Glottal Stops `'`)**: Spoken Cherokee regularly inserts phonetic aspiration (`h`) or glottal closure (`'`) at morpheme boundaries that are not written in standard 85-character Sequoyan syllabary.
3. **Inline Syllabary Diacritics & Clause Splitting**: Inline under-dots/periods used as diacritics in marked syllabary transcripts (e.g. `Ꮳ.Ꮧ`) are stripped without splitting words, while true sentence boundaries (`?`, `!`, `...`) and stutter hyphens (`--`) guide clause segmentation.
4. **Laughter Filtering**: When English translations contain `[laughter]` or `[laughs]`, untranscribed or stage-direction Cherokee laughter tokens (`ᎤᏰᏣᏍᎦ` / `ᎤᏂᏰᏣᏍᎦ`) are filtered prior to acoustic alignment.

### Quality Indicators & Confidence Scores
Each aligned word and phrase carries a CTC acoustic confidence score (`0.0` to `1.0`):
- **Clear match (`≥ 80%`)**: High acoustic certainty (green).
- **Approximate match (`10% – 79%`)**: Rapid speech, conversational vowel dropping, or dialect variation (amber).
- **Uncertain timing (`< 10%`)**: Potential overlap, background noise, or misalignment (red). Matches below `5%` are hidden by default unless the user toggles **"Include uncertain matches"**.

---

## 4. Development & Scripts

### Frontend
```bash
npm install
npm run dev      # Start Vite dev server
npm test         # Run Vitest unit tests (src/lib/search.test.ts)
npm run build    # Type-check and build production bundle
```

### Corpus & Alignment Scripts
Use the `cherokee-asr` Conda environment (`/opt/homebrew/Caskroom/miniconda/base/envs/cherokee-asr/bin/python`):

```bash
# Run batch forced alignment on Saving the Voices interviews (CPU / ARM NEON)
/opt/homebrew/Caskroom/miniconda/base/envs/cherokee-asr/bin/python scripts/align_stv_poc.py --interviews 0001 0004 0006 0010 --device cpu

# Rebuild public/data/sources.json and public/data/phrases.json
/opt/homebrew/Caskroom/miniconda/base/envs/cherokee-asr/bin/python scripts/build_corpus.py --reuse-existing-dict-nt

# Run Python unit tests
/opt/homebrew/Caskroom/miniconda/base/envs/cherokee-asr/bin/python -m unittest scripts/test_align_stv_poc.py scripts/test_build_corpus.py
```
