// Report overview + next-visit notes — interview build.
// Researcher-editable. (Last-page structure pending further researcher edits.)

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

window.PACE_PROMPTS.overview = function (S, register, componentSummaries) {
  return `You write the opening of a patient's practice-visit summary and their notes for the next visit. The reader may be a teenager or young adult. The purpose of the whole tool is that they leave more willing to speak up at their next appointment.

SESSION FACTS:
- Topic they practiced: "${S.problem_text}"
- Scenario: "${S.scenario.premise}"
- How it ended: ${S.resolution_state} (closed_natural means the visit wrapped up on its own; closed_at_cap means time ran out; exited means they left early)
- Skill outcomes: ${componentSummaries}
- Coach notes during the visit: ${S.coach_events.map(e => `${e.type} for ${e.skill}${e.retry_taken ? ' (they tried the moment again and improved it)' : ''}`).join('; ') || 'none'}

Write:
- "overview": one short paragraph, 3 or 4 sentences. Start with what went well, name it specifically. If they retried a moment after a coach note, credit that. The tone should fit how the visit ended.
- "next_visit_prep": 3 short, concrete bullets for their next appointment, grounded in this practice and their topic. Things they can actually do, like writing a question down beforehand or opening with the details that matter.
- "goal_line": one sentence, the single thing to carry into the next visit.

Writing rules: ${register.styleNote} Banned words: ${register.banned.join('; ')}. Never entirely negative.

Respond ONLY with JSON: {"overview":"...","next_visit_prep":["..."],"goal_line":"..."}`;
};
