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
- "strengths": 2 or 3 sentences on what they did well, named specifically (which skills, which moments). If they retried a moment after a coach note, credit that.
- "growth": 1 or 2 sentences on where there is room to build, phrased gently and pointed at what to try, not what went wrong. If there is nothing meaningful, say the session was solid and name what to keep doing.
- "next_visit_prep": 3 short, concrete bullets for their next appointment, grounded in this practice and their topic. Things they can actually do, like writing a question down beforehand or opening with the details that matter.

Writing rules: ${register.styleNote} Banned words: ${register.banned.join('; ')}. Never entirely negative.

Respond ONLY with JSON: {"strengths":"...","growth":"...","next_visit_prep":["..."]}`;
};
