# Vibe Check Security Scanner — Design Spec
**Date:** 2026-04-03  
**Project:** vibe-code-check-me  
**Status:** Approved

---

## Overview

Integrate context-guard (a documentation coverage scanner for AI-generated projects) as the new "Vibe Check" tab in the vibe-code-check-me app. The current "Vibe Check" (GitHub stats Wrapped experience) becomes the "Wrapped" tab. Navigation grows from 2 tabs to 3.

---

## Navigation Changes

### Tab Order (left → right)

| Position | Label | What it shows | Screen IDs |
|----------|-------|---------------|------------|
| 1 (new) | Vibe Check | context-guard scanner | `vibe-check` |
| 2 (renamed) | Wrapped | GitHub stats stories | `landing`, `loading-screen`, `stories` |
| 3 (unchanged) | Community | project feed, submit, detail | `community`, `submit`, `project` |

### nav.js Changes
- Add `nav-tab-vibe-check` button as first tab
- Rename `nav-tab-home` label from "Vibe Check" to "Wrapped"
- Brand button navigates to Vibe Check tab (first tab = default landing)
- Update SECTIONS map:

```js
const SECTIONS = {
  'vibe-check': ['vibe-check'],
  home: ['landing', 'loading-screen', 'stories'],
  community: ['community'],
  submit: ['submit'],
  project: ['project'],
};
```

### index.html Changes
- Add `nav-tab-vibe-check` button before `nav-tab-home`
- Add `#vibe-check` screen div
- On initial load, show `vibe-check` screen (not `community`)

---

## Vibe Check Screen

### Three UI States

#### State 1 — Input (default)
- Shield icon (SVG) + "Vibe Check" heading
- Subtitle: "Security scanner for AI-generated code"
- Category badge teasers (decorative, static): SETUP · ARCH · STANDARDS · SECURITY · PERFORMANCE · DEPLOY
- Single text input: placeholder `github.com/owner/repo` or `owner/repo`
- "Scan Repo" primary button
- On invalid input: inline error below the field

#### State 2 — Loading
- Animated progress: cycles through the 6 category names as they appear to be "checking"
- Uses existing app loading animation patterns (CSS keyframe)
- Shows repo name being scanned

#### State 3 — Results
- Header card: repo name + circular score ring (0–100, amber/orange `#ff6b35`)
- Category badge row: each badge colored by status (green=PASS, orange=PARTIAL, red=MISSING)
- Category list (6 rows), each showing:
  - Status icon: ✓ PASS · ~ PARTIAL · ✗ MISSING
  - Category label
  - Expandable: matched keywords + recommendation text from context-guard
- "Scan Another Repo" button resets to State 1

### Score Ring
- SVG circular progress ring, same visual as context-guard README screenshot
- Color: `#ff6b35` (orange, existing `--orange` token)
- Score displayed as large number in center: `72 / 100`
- Label below: `OVERALL SCORE`

---

## File Structure

### New Files
```
src/
├── vibe-check/
│   ├── scanner.js       # context-guard logic ported to browser JS
│   └── vibe-check.js    # UI controller (3 states)
└── styles/
    └── vibe-check.css   # scanner screen styles
```

### Modified Files
```
index.html               # add #vibe-check screen + nav tab button
src/community/nav.js     # add tab, rename, update SECTIONS
src/app.js               # wire up vibe-check tab click + screen switch
```

---

## Scanner Logic (`src/vibe-check/scanner.js`)

Direct port of `context-guard/bin/context-guard.js` core scanning logic.

### Input
- GitHub repo string: accepts `owner/repo` or full URL `https://github.com/owner/repo`

### File Fetching
1. Parse `owner` and `repo` from input
2. Request GitHub Contents API: `GET /repos/{owner}/{repo}/contents/` (root listing)
3. Look for named context files (same priority order as context-guard):
   - `CLAUDE.md`, `AGENTS.md`, `README.md`, `MEMORY.md`, `SOUL.md`, `USER.md`
4. Fetch content of each found file (base64 decode from GitHub API response)
5. Fallback: if none found, fetch all `.md` files up to 2 directory levels deep
6. Combine all file contents into one lowercase string corpus

### Scoring (exact context-guard logic)
```
For each of 6 categories:
  matchedCount = keywords that appear in corpus (case-insensitive substring)
  if matchedCount === 0:        status = MISSING,  score = 0
  elif matchedCount <= 2:       status = PARTIAL,  score = 60
  else:                         status = PASS,     score = 100
  
overallScore = Math.round(average of all 6 category scores)
```

### Categories (exact from context-guard)
| Label | Keywords (10 each) |
|-------|-------------------|
| Setup/Run Commands | install, setup, run, start, quick start, usage, npm, pnpm, yarn, node |
| Architecture/Context | architecture, context, overview, system, components, workflow, mission, purpose, scope |
| Coding/Testing Standards | code style, convention, lint, format, test, testing, unit test, integration test, review, quality |
| Security/Privacy Guardrails | security, privacy, secret, token, api key, credential, sensitive, permission, guardrail, leak |
| Performance/Time Constraints | performance, latency, timeout, memory, limit, timebox, 2-4 hours, 2–4 hours, scope cap, fast |
| Deployment/Account Guardrails | deploy, deployment, publish, release, github, vercel, owner, account, team, auth |

### Output Shape (mirrors context-guard JSON)
```js
{
  repo: 'owner/repo',
  overallScore: 72,
  scanMode: 'named-context-files' | 'fallback-markdown',
  scannedFiles: ['CLAUDE.md', 'README.md'],
  categories: [
    {
      id: 'setup_run_commands',
      label: 'Setup/Run Commands',
      status: 'PASS' | 'PARTIAL' | 'MISSING',
      score: 100 | 60 | 0,
      matchedKeywords: ['npm', 'install', 'run'],
      recommendation: '...'
    },
    // × 6
  ]
}
```

### Error Handling
- Invalid repo format: inline validation before fetch
- Repo not found (404): user-friendly message "Repo not found or is private"
- GitHub rate limit (403/429): show remaining limit message (reuses existing github-api.js rate limit pattern)
- Network error: generic retry message

---

## Styling

Follows existing design tokens in `src/styles/base.css`:

| Element | Token / Value |
|---------|--------------|
| Screen background | `--bg` (#0a0a0a) |
| Card background | `--bg-card` (#121212) |
| Score ring color | `--orange` (#ff6b35) |
| PASS badge | `--green` (#1DB954) |
| PARTIAL badge | `--yellow` (#f5c518) |
| MISSING badge | `--red` (#e8115b) |
| Heading font | Dela Gothic One |
| Body font | Outfit |
| Border radius | `--radius-md` (16px) / `--radius-lg` (24px) |

Category badge labels use short abbreviated forms to match the image aesthetic:
`SETUP · ARCH · STANDARDS · SECURITY · PERF · DEPLOY`

---

## What Does Not Change
- The GitHub Wrapped flow (`src/terminal.js`, all features) — untouched, just relabeled "Wrapped"
- Community feed, submit, project detail — untouched
- Convex backend — no changes needed
- Auth flow — no changes needed
- All existing CSS — additive only, no modifications to existing styles
