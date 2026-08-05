// Stage 4 — Level 1 overview + next-visit prep (HANDOVER_SPEC_V2.md §7.6–§7.8).
// Conditioned on resolution_state, assigned_component, AND feedback_intensity.
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

window.PACE_PROMPTS.overview = function (S, register, componentSummaries) {
  const sv = S.survey_responses;
  const light = S.feedback_intensity === 'light';
  return `You write the opening of a patient's practice-session summary and their notes for the next real visit. This reader may be an adolescent or young adult; the goal of the whole tool is that they leave MORE willing to speak up at their next real visit — self-efficacy first.

SESSION FACTS:
- Scenario: "${S.scenario.premise}"
- Target skill: ${S.assigned_component} (P=Present/telling your story, A=Ask, C=Check, E=Express)
- Ending: ${S.resolution_state} (resolved_early = they got what they needed with time to spare; resolved_at_cap = got there as time ran out; unresolved = the key behavior never quite landed)
- Their goal: "${sv.visit_goal}" · Must-ask question: "${sv.must_ask_question}" (asked: ${S.visit.must_ask_asked})
- Worry: ${sv.worry_level}/5${sv.suspected_cause ? ` (feared: "${sv.suspected_cause}")` : ''}
- Skill outcomes: ${componentSummaries}
- Feedback intensity: ${S.feedback_intensity}${light ? ' — this participant screened as already-skilled: frame the session as a successful rehearsal, lead with what they DID (observation, not judgment), and keep any improvement talk to one light touch at most.' : ''}

REGISTER (hard rules): ${register.readingLevel} reading level. BANNED: ${register.banned.join('; ')}. Say "skill" not "component". Warm, specific, never judging the person. Never entirely negative — if little landed, lead with their effort and the specific things they tried.

Write:
- "overview": ONE short paragraph (3–4 sentences), per-skill status woven in, tone visibly matching the ending state.
- "next_visit_prep": 3–4 short, concrete bullets for their NEXT REAL visit, grounded in this session and their survey (e.g., bring the must-ask question written down; the specific details worth telling first about "${sv.problem_text}").
- "goal_line": ONE sentence — the single thing to carry into the next real visit.

Respond ONLY with JSON: {"overview":"...","next_visit_prep":["..."],"goal_line":"..."}`;
};
