// Stage 4 — per-utterance annotator (HANDOVER_SPEC_V2.md §7.2–§7.3).
// Key v2 rules: appropriateness is a GATE (§7.2.1); every negative annotation
// requires linked_opportunity or a survey-anchored global check (§7.5); the
// continuity lists BLOCK bad critique (§7.3.6, pilot F2); participant-facing
// register per §7.8.
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

function mistakeListText(mistakes) {
  return ['P', 'A', 'C', 'E'].map(k =>
    `${k} — ${mistakes[k].name} (${mistakes[k].plain}). Concrete mistakes to match against:\n` +
    mistakes[k].mistakes.map(m => `  · ${m}`).join('\n')
  ).join('\n');
}

window.PACE_PROMPTS.annotator = function (S, mistakes, register, transcriptText, utteranceRange) {
  const sv = S.survey_responses;
  return `You give feedback to a patient who practiced for a medical visit in a role-play. Roles: patient (the trainee — every judgment is about their messages) and clinician (simulated). Annotate each PATIENT message.

THE FOUR SKILLS AND THEIR CONCRETE MISTAKES (match ONLY against these, never abstract labels):
${mistakeListText(mistakes)}

SURVEY CONTEXT:
- Issue: "${sv.problem_text}" (${sv.problem_duration}; worry ${sv.worry_level}/5${sv.suspected_cause ? `; feared cause: "${sv.suspected_cause}"` : ''})
- Visit goal: "${sv.visit_goal}"
- Must-ask question: "${sv.must_ask_question}"
- Treatments listed: ${(sv.current_treatments || []).map(t => t.name).join(', ') || '(none)'}
- Target skill this session: ${S.assigned_component}

INFORMATION-CONTINUITY LISTS (these BLOCK certain critique — hard rules):
- The clinician's chart already contained: ${JSON.stringify(S.scenario.clinician_knows)}
  → NEVER critique the patient for not presenting/repeating anything on that list. The doctor already had it.
- Known to neither party: information in neither list must not generate an Ask critique — the patient could not have known to ask.

PLANTED OPPORTUNITIES (with live-tracked status):
${S.embedded_opportunities.map(o => `- ${o.id} [${o.component}] ${o.trigger} → expected: ${o.expected_behavior} → status: ${o.status}`).join('\n')}

TRANSCRIPT (patient turns numbered; COACH lines are asides the clinician never saw):
${transcriptText}

ANNOTATE ${utteranceRange ? `patient turns ${utteranceRange[0]}–${utteranceRange[1]}` : 'every patient turn'}. Exactly two options each:
- Option I — appropriate, good behavior at that point: {"appropriate": true, optional "good_areas": [skill letters]}. STOP THERE — an appropriate message gets NO further feedback of any kind. Expect roughly half or more of messages to be appropriate; do not manufacture critique.
- Option II — could improve: {"appropriate": false} PLUS:
  · "linked_opportunity": REQUIRED — the id of the planted opportunity this critique is anchored to, OR "global_must_ask" (their must-ask question went unasked at this natural moment), OR "global_worry" (worry is ${sv.worry_level}/5 ≥3 and went unvoiced when the topic came up), OR null if you cannot anchor it (unanchored critiques are dropped downstream — that is intended).
  · "feedback": starts with the literal words "The goal is to", then what the goal was at that point and how the message could better meet it — tentative, third person ("it might help to…"), ~35 words max.
  · "bad_areas": skill letters, ONLY where a listed concrete mistake applies.
  · "alternative": a message they could have sent instead (achieves the stated goal, their plausible voice, ~28 words max).
  · optional "good_areas" — name what was good even in a message needing work.

REGISTER (participant-facing text — hard rules): ${register.readingLevel} reading level. BANNED words/phrases: ${register.banned.join('; ')}. Say "skill", not "component". Warm, specific, plain.

Also output:
- "opportunity_review": final judgment per planted opportunity: "met" | "partial" | "missed" | "not_surfaced".
- "global_checks": {"must_ask_question_asked": true/false, "worry_voiced": true/false}

Respond ONLY with JSON:
{
  "annotations": [ { "turn": 1, "utterance": "first ~10 words…", "appropriate": true/false, "good_areas": [], "linked_opportunity": "opp_1|global_must_ask|global_worry|null", "feedback": "The goal is to …", "bad_areas": [], "alternative": "…" } ],
  "opportunity_review": [ { "id": "opp_1", "status": "met" } ],
  "global_checks": { "must_ask_question_asked": true, "worry_voiced": false }
}`;
};
