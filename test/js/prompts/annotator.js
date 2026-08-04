// Stage 4 — per-utterance annotator (HANDOVER_SPEC.md §6.2, §6.4).
// Adapted from the Chaszczewicz et al. (ACL 2024) Appendix I structure,
// rewritten for PACE. Accepts an utterance range so chunking is trivial to
// add later (§6.4 engineering note).
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

function mistakeListText(mistakes) {
  return ['P', 'A', 'C', 'E'].map(k =>
    `${k} — ${mistakes[k].name} (${mistakes[k].plain}). Concrete mistakes to match against:\n` +
    mistakes[k].mistakes.map(m => `  · ${m}`).join('\n')
  ).join('\n');
}

window.PACE_PROMPTS.annotator = function (S, mistakes, transcriptText, utteranceRange) {
  const sv = S.survey_responses;
  return `You give feedback to a patient who just practiced for a medical visit in a role-play. The two roles are the patient (the trainee — every judgment is about their messages) and the clinician (simulated). You will annotate each PATIENT utterance.

PACE COMPONENTS AND THEIR CONCRETE MISTAKES (match against these, not the abstract labels):
${mistakeListText(mistakes)}

SURVEY-DERIVED CONTEXT (use it — this is what makes the feedback specific):
- Their issue: "${sv.problem_text}" (${sv.problem_duration}; worry ${sv.worry_level}/5)
- Feared cause: "${sv.suspected_cause || '(none given)'}"
- Their goal for the visit: "${sv.visit_goal}"
- Their must-ask question: "${sv.must_ask_question}"  ← an unasked must-ask question is only detectable because the survey captured it; check for it.
- Session's target component: ${S.assigned_component}

EMBEDDED OPPORTUNITIES (moments the visit deliberately created, with live-tracked status):
${S.embedded_opportunities.map(o => `- ${o.id} [${o.component}] ${o.trigger} → expected: ${o.expected_behavior} → status: ${o.status || 'not surfaced'}${o.detected_at_turn != null ? ' (turn ' + o.detected_at_turn + ')' : ''}`).join('\n')}

TRANSCRIPT (patient turns numbered):
${transcriptText}

ANNOTATE ${utteranceRange ? `patient turns ${utteranceRange[0]}–${utteranceRange[1]}` : 'every patient turn'}. For each, exactly two options:
- Option I — the response is appropriate, good PACE behavior at this point. Set "appropriate": true; optionally tag "good_areas" with the component letters it exemplified. NO further feedback for that utterance.
- Option II — the response could improve. Set "appropriate": false and produce:
  Part A "feedback": MUST start with the literal phrase "The goal is to", stating what the goal should be at this point in the visit, then how the response could better align — phrased tentatively and in third person ("it might be better to…", "it could help to…"; never "the patient did X wrong"). Vary the stock phrasing across annotations. Short dialogue fragments may be quoted. Target ~35 tokens.
  Part B "bad_areas": one or more component letters, chosen ONLY where a listed concrete mistake applies.
  Part C "alternative": a concrete message the patient could have sent instead, which must achieve Part A's goal, in the patient's plausible voice (match their register — not idealized or clinical). Target ~28 tokens.
  Optionally "good_areas" too — name what they did well even in an utterance needing work.

Judge each utterance against everything earlier in the conversation plus the survey context. Base rates from the source dataset: expect roughly half of utterances to be appropriate — do not manufacture critique. Tone: professional, friendly, focused on what is most beneficial for the trainee to hear.

Also produce "opportunity_review": for each embedded opportunity, your final judgment "met" | "partial" | "missed" | "not_surfaced" (correct the live status if the transcript shows otherwise).

Respond ONLY with JSON:
{
  "annotations": [
    { "turn": 1, "utterance": "first ~10 words…", "appropriate": true/false,
      "good_areas": ["P"], "feedback": "The goal is to …", "bad_areas": ["C"], "alternative": "…" }
  ],
  "opportunity_review": [ { "id": "opp_1", "status": "met|partial|missed|not_surfaced" } ]
}`;
};
