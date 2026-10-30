---
id: TASK-11
title: >-
  Simplify UI language for community users and consolidate technical docs into
  README.md
status: Done
assignee:
  - '@self'
created_date: '2026-10-30 19:41'
updated_date: '2026-10-30 19:46'
labels: []
dependencies: []
modified_files:
  - src/App.tsx
  - src/components/PhraseCard.tsx
  - README.md
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove CS/linguistics jargon from the UI (CTC, 3-gram, Strict T/TH, Broad Phonetic, Flagged Anomalies) for a general community audience, use "Standard (d/t)" and "Linguistic (t/th)" search box labels, replace numeric confidence badges with friendly quality labels + hover tooltips, embed the complete community guide inside the in-app "How It Works" modal, and move developer/technical documentation into README.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Header, search boxes ('Standard (d/t)', 'Linguistic (t/th)', 'English Meaning'), sort options, and filter toggle use plain community-friendly language with no CTC/CS jargon
- [x] #2 Result cards use friendly quality indicators ('Clear match', 'Approximate', 'Uncertain timing') with hover tooltips showing exact confidence percentages, and remove inline word % clutter and Strict/Broad badges
- [x] #3 In-app 'How It Works' modal contains the complete community guide plus an expandable 'Under the Hood' section
- [x] #4 Developer and technical documentation is consolidated into README.md, docs/TERMINOLOGY.md is removed, and all tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update PhraseCard.tsx: replace numeric % badges with friendly quality badges ("Clear match", "Approximate", "Uncertain timing") + Info hover tooltips, remove Strict/Broad badges and inline word %, and rename "Segment Audio (Unaligned)" to "Full Turn Audio"
2. Update App.tsx: simplify header, label search boxes as "Standard (d/t)", "Linguistic (t/th)", and "English Meaning", remove preview pills, simplify filter toggle to "Include uncertain matches" + machine-generated timing note, rename sort options, rewrite welcome card & example descriptions, and build full "How It Works" modal with expandable "Under the Hood"
3. Consolidate developer and technical documentation into README.md and remove docs/TERMINOLOGY.md
4. Run vitest and vite build
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Simplified all UI language for a general Cherokee community audience and consolidated technical documentation into README.md:
- Header simplified to "Search Spoken Cherokee Recordings & Translations" with a "How It Works" modal button
- Search boxes labeled "1. Standard Spelling (d/t)", "2. Linguistic Spelling (t/th)", and "3. English Meaning"
- Replaced numeric confidence badges and Strict/Broad badges with friendly quality indicators ("Clear match", "Approximate match", "Uncertain timing") with hover tooltips showing exact confidence percentages
- Replaced dual technical filter buttons with a single "Include uncertain matches" toggle and a friendly note explaining computer-generated timing
- Renamed sort options to "Best Audio Match", "Clearest Recording", "Shortest Phrase", and "Book / Interview Order"
- Built the complete user-facing guide (with expandable "Under the Hood" section) inside the "How It Works" modal and consolidated developer docs into README.md
<!-- SECTION:FINAL_SUMMARY:END -->
