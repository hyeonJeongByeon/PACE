// Stage 4 — Level 1 overview + next-visit preparation (HANDOVER_SPEC.md §6.5,
// §6.7 tone rules; feed-forward per Hattie & Timperley).
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

window.PACE_PROMPTS.overview = function (S, componentSummaries) {
  const sv = S.survey_responses;
  return `You write the opening of a patient's practice-session summary and their preparation notes for the next real visit. Warm, specific, plain language (grade 6). Never judge the person — describe behaviors.

SESSION FACTS:
- Practiced scenario: "${S.scenario.premise}"
- Target skill: ${S.assigned_component} (P=Present, A=Ask, C=Check, E=Express)
- How the visit ended: ${S.resolution_state} (resolved_early = they got what they needed with time to spare; resolved_at_cap = got there as time ran out; unresolved = the visit ended without the key behavior landing)
- Their goal for the real visit: "${sv.visit_goal}"
- Their must-ask question: "${sv.must_ask_question}"
- Their worry (0–5): ${sv.worry_level}${sv.suspected_cause ? `, feared cause: "${sv.suspected_cause}"` : ''}
- Per-component outcomes: ${componentSummaries}

RULES:
- "overview": ONE short paragraph (3–4 sentences) with per-component status woven in. Its tone must reflect resolution_state — a resolved_early session should read visibly differently from an unresolved one. Lead with what went well. Never entirely negative: if little was met, lead with effort and the specificity of what they tried, then the single highest-leverage thing.
- "next_visit_prep": 3–4 short bullets the participant can act on at their NEXT REAL visit, grounded in this session and their survey (e.g., bring the must-ask question written down; the specific detail set to present about "${sv.problem_text}"). Concrete, not generic advice.
- "goal_line": ONE sentence — the single goal to carry into the next real visit (feed-forward).

Respond ONLY with JSON:
{"overview":"...","next_visit_prep":["...","...","..."],"goal_line":"..."}`;
};
