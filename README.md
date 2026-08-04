# PACE Prototype v2

Web-based patient communication training: a pre-visit survey tailors an
LLM-simulated clinician visit; a coach nudges during the role-play; a
structured summary (report card) closes the session. Built to
`HANDOVER_SPEC.md` (authoritative; see `CLAUDE.md` for authorized deviations
and project rules).

**Participant link:** `https://hyeonjeongbyeon.com/PACE/test/?pass=<passcode>`

## Session flow

1. **PACE education** — the four skills, one line + one example each (draft wording)
2. **Scenario choice** — five communication-challenge seeds
3. **Pre-visit survey** — Getting Ready / PACE Guide Sheet / LEAPS items;
   scores the participant's `assigned_component` (P/A/C/E)
4. **Instantiation** — one LLM call builds scenario + persona + 3–5 embedded
   opportunities from survey + seed (clinician_knows vs does_not_know split)
5. **Role-play** — no turn cap; a ~10-minute visit clock the clinician manages
   like a real appointment (12-min hard stop). Two-step plan→generate pipeline;
   yield-to-correct-PACE-behavior logic; budgeted in-session coach asides
6. **Summary** — annotator (per-utterance, mistake-list-grounded) →
   aggregation with the volume cap → substitution QA check → three-level
   report + next-visit prep, viewable and downloadable (Markdown + JSON + print)

## Repository layout

```
HANDOVER_SPEC.md        authoritative design spec
CLAUDE.md               project rules + authorized deviations + CONFIRM status
test/                   the app (static, no build step)
  js/config.js          proxy URL, visit clock, coach budgets, volume cap
  js/survey.js          survey items (provenance-tagged)   ← edit content here
  js/scenarios.js       five scenario seeds               ← edit content here
  js/mistakes.js        PACE mistake lists (§6.3 drafts)  ← edit content here
  js/prompts/*.js       one prompt per file               ← edit prompts here
  js/state.js           SessionState, assignComponent() (pluggable), logging
  js/app.js             engine
.githooks/pre-commit    participant-data leak check
```

## Development

```bash
git config core.hooksPath .githooks   # once, after cloning
python3 -m http.server 8080           # then open http://localhost:8080/test/
```

Model calls go through the shared Cloudflare Worker proxy
(`pace-proxy.pace-formative.workers.dev`) which holds the API key and the
study passcode. Nothing is stored server-side; transcripts and summaries are
client-side downloads only.
