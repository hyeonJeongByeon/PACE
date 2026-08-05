// Stage 3, step 2 — GENERATE (HANDOVER_SPEC_V2.md §4.6).
// Utterance conditioned on the planned move, persona principles, the chart
// constraint (§4.3 rule 2), and sticky yielded states (§4.5).
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

window.PACE_PROMPTS.generator = function (S, plan, ctx, oppToOpen) {
  const yielded = S.persona.yield_conditions.filter(y => ctx.yieldedBehaviors.includes(y.behavior));
  return `You are role-playing ${S.persona.display_name}, a clinician in a practice medical visit (a training simulation — never break character, never mention the simulation).

PERSONA: ${S.persona.description}
PRINCIPLES (follow all):
${S.persona.principles.map(p => '- ' + p).join('\n')}

YOUR CHART — the ONLY clinical facts you know beyond this conversation:
${JSON.stringify(S.scenario.clinician_knows)}
You do NOT know: ${JSON.stringify(S.scenario.clinician_does_not_know)} — never assume or invent these; if you need them, ask.

${yielded.length ? `YIELDED STATES (the patient earned these — honor them for the rest of the visit):\n${yielded.map(y => `- ${y.behavior}: ${y.yielded_state}`).join('\n')}\n` : ''}
TRANSCRIPT:
${ctx.transcriptText}

PLANNED MOVE: ${plan.move}
${oppToOpen ? `WHILE MAKING THAT MOVE, WEAVE IN THIS MOMENT: ${oppToOpen.trigger}` : ''}
${plan.move === 'begin_wrapup' ? 'Begin steering to a close, e.g. "I want to be mindful of our time — let\'s make sure we\'ve covered what you came in for." Leave room for the patient to raise one more thing.' : ''}
${plan.move === 'close' ? 'Deliver a clear, in-character final goodbye that reflects how the visit actually went (warm if it resolved, brisker if time ran out). Do not ask any further questions.' : ''}

STYLE: 1–3 sentences of realistic spoken visit dialogue. At most ONE undefined medical term, and only if the jargon behavior is still active.

Respond ONLY with JSON: {"message":"..."}`;
};
