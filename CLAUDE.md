# PACE Prototype v2 — Project Rules

## Authoritative spec
`HANDOVER_SPEC.md` is the authoritative design spec. Its §1–4 are settled;
its **CONFIRM** items must not be silently resolved.

## Researcher-authorized deviations from the handover (Aug 2026)
Recorded per the handover's own "flag deviations" rule:
1. **Scenario selection menu exists** (handover §5.1 said assigned-only) —
   participants browse and choose among five scenario seeds.
2. **No 12-turn cap** (handover §5.1) — replaced with elapsed-time budget and
   clinician clock-management (Advisor 2: turns are the wrong unit; terse
   participants burn them, verbose ones don't).
3. **In-session coach enabled in v1** (handover §6.8 said ex-post only) —
   occasional inline nudges with strict budget, never stacking, plus the full
   ex-post report card.

## CONFIRM items — current working resolutions (revisit with advisor)
- Backend: Anthropic API via the deployed Cloudflare Worker proxy
  (`pace-proxy.pace-formative.workers.dev`), shared with the v1 prototype.
  The Vertex AI / BAA path is NOT implemented; `LLMClient` is a single
  swappable module (`test/js/config.js` + fetch in `app.js`).
- Five doctor personas from the v1 prototype: used as **seeds** for the
  survey-tailored instantiation (handover §4.3 CONFIRM).
- Cluster-taxonomy mapping (§3.4 CONFIRM): not applied; `assignComponent()` in
  `test/js/state.js` is the single pluggable function to replace.
- Survey administered in-app. Report card shown on web + downloadable.
  Single-session (no §6.9 longitudinal comparison).

## Data rules (firm, from handover §7)
- No participant data in this public repo, ever: no fixtures from real
  sessions, no transcripts, no survey exports, no response IDs or emails.
  Synthetic data only. Pre-commit hook in `.githooks/` greps for likely leaks;
  keep `git config core.hooksPath .githooks` set.
- API keys never in this repo or the client; all model calls go through the
  serverless proxy.
- Transcripts/report cards are downloaded client-side by the participant or
  researcher; nothing is persisted server-side.

## Editability contract
Prompts live in `test/js/prompts/` (one file per prompt). Survey items in
`test/js/survey.js`, scenario seeds in `test/js/scenarios.js`, PACE mistake
lists (handover §6.3, drafts pending advisor review) in `test/js/mistakes.js`.
The researcher iterates on these files; engine code should not need to change.
