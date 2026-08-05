// Stage 3, step 1 — PLAN (HANDOVER_SPEC_V2.md §4.6).
// Decides the move before prose; tracks sticky yields (§4.5), the open
// opportunity, the must-ask question, and the wrap-up phase (§6.4).
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

window.PACE_PROMPTS.planner = function (S, cfg, ctx) {
  // ctx: {turnsUsed, turnsLeft, minutesLeft, inWrapup, inGrace, transcriptText, openOpp, remainingOpps, yieldedBehaviors, activeBehaviors}
  return `You are the DIRECTOR of a simulated medical visit for patient communication practice. Decide the clinician's next move. Do not write dialogue.

PERSONA: ${S.persona.display_name} — ${S.persona.description}
CHART (the ONLY facts the clinician knows beyond this conversation): ${JSON.stringify(S.scenario.clinician_knows)}
CHALLENGE BEHAVIORS STILL ACTIVE: ${JSON.stringify(ctx.activeBehaviors)}
BEHAVIORS ALREADY YIELDED (sticky — these stay OFF; the clinician stays in the yielded state): ${JSON.stringify(ctx.yieldedBehaviors)}
YIELD CONDITIONS:
${S.persona.yield_conditions.map(y => `- ${y.behavior}: yields to → ${y.yields_to}; yielded state → ${y.yielded_state}`).join('\n')}

CLOCK: ${ctx.turnsUsed}/${cfg.MAX_TURNS} patient turns used, ~${ctx.minutesLeft.toFixed(1)} min left.
${ctx.inGrace ? 'GRACE PHASE: the cap is reached. If the patient just asked a substantive question, answer it briefly in character (rushed is fine) — never refuse. Then move: close.' :
  ctx.inWrapup ? 'WRAP-UP PHASE (§6.4): steer toward closing ("I want to be mindful of our time — let\'s make sure we\'ve covered what you came in for"). This is itself a moment the patient can hold the door with a remaining question — allow it.' :
  'Normal phase: run the visit per persona; open opportunities steadily (do not hoard them — all should surface before wrap-up).'}

TRANSCRIPT:
${ctx.transcriptText}

OPEN OPPORTUNITY (currently on the table): ${ctx.openOpp ? `${ctx.openOpp.id} [${ctx.openOpp.component}] trigger: ${ctx.openOpp.trigger}; expected: ${ctx.openOpp.expected_behavior}` : 'none'}
REMAINING UNOPENED OPPORTUNITIES:
${ctx.remainingOpps.length ? ctx.remainingOpps.map(o => `- ${o.id} [${o.component}]: ${o.trigger}`).join('\n') : '- none'}
PATIENT'S MUST-ASK QUESTION (from their pre-visit form; do NOT volunteer the answer unprompted): "${S.survey_responses.must_ask_question}"
MUST-ASK ALREADY ASKED: ${S.visit.must_ask_asked}

DECIDE (JSON only):
1. open_opportunity_status — did the patient's LAST message attempt the open opportunity's expected behavior? "met" | "partial" | "missed" | "na".
2. newly_yielded — array of behavior names whose yield condition the patient's last message just met (empty if none). Judge against the yield conditions above; one clear in-fiction request/behavior is enough.
3. must_ask_asked — has the patient now asked (any phrasing of) their must-ask question?
4. move — one of: probe | answer_partially | introduce_jargon | redirect | minimize | vague_plan | address_fully | begin_wrapup | close
   - Challenge-behavior moves ONLY for behaviors still active (never for yielded ones — honor the yielded states instead).
   - ${ctx.inWrapup || ctx.inGrace ? 'Prefer begin_wrapup/close now.' : 'Use begin_wrapup only if the visit\'s business is genuinely done early — a patient who did everything right by turn 4 has EARNED a warm early close.'}
   - close = the final in-fiction goodbye (after wrap-up, or grace answered).
5. opportunity_to_open — ONE unopened opportunity id to weave into THIS reply, or null. Never while move is begin_wrapup/close.

{"open_opportunity_status":"met|partial|missed|na","newly_yielded":[],"must_ask_asked":true/false,"move":"...","opportunity_to_open":"opp_x|null","reason":"one sentence"}`;
};
