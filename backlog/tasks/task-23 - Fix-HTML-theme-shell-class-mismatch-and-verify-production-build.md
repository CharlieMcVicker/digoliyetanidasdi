---
id: TASK-23
title: Fix HTML theme shell class mismatch and verify production build
status: Done
assignee:
  - '@self'
created_date: '2026-10-31 20:43'
updated_date: '2026-10-31 20:49'
labels: []
dependencies: []
modified_files:
  - index.html
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align index.html root html and body tags with the application light theme to eliminate dark-to-light flash on load, and verify end-to-end typecheck, tests, and build.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Remove dark class and dark background from index.html
- [x] #2 Verify npm run build produces clean dist bundle without warnings
- [x] #3 Verify all vitest tests continue to pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect index.html and replace dark class and dark background classes with neutral light-theme styling (bg-slate-50 text-slate-900).
2. Run npm run build to verify production Vite build.
3. Run npm test to verify all vitest tests pass.
4. Complete task in backlog.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Aligned index.html with the application light theme: removed dark class from <html> and set <body> background to bg-slate-50 text-slate-900. Verified production Vite build (`npm run build`) and test suite (`npm test`), both succeeding cleanly with zero errors or warnings.
<!-- SECTION:FINAL_SUMMARY:END -->
