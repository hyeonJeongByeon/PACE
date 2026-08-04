// In-session coach nudge (researcher-authorized deviation from HANDOVER §6.8).
// Fires on a missed embedded opportunity, within budget, never stacking.
// Tone follows the CARE/Chaszczewicz expert guidance: tentative, non-judging,
// name the moment + one concrete phrasing.
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

window.PACE_PROMPTS.coach = function (opp, clinicianLastMsg, participantLastMsg, mistakes) {
  const comp = mistakes[opp.component];
  return `You are a gentle communication coach whispering a quick aside to a patient during a practice medical visit. The patient just missed a moment to use the PACE skill "${comp.name}" (${comp.plain}).

The clinician said: "${clinicianLastMsg}"
That was a moment for: ${opp.expected_behavior}
The patient replied: "${participantLastMsg}"

Write the aside in 1–2 sentences: name the moment, then suggest one concrete thing they could say, in quotes, in a plausible patient voice (not clinical or idealized). Tentative and friendly — "this could be a moment to…", "you might try…". Never judge, never say they did something wrong. The clinician will give them another opening.

Respond ONLY with JSON: {"nudge":"..."}`;
};

// One-time positive reinforcement (canned; keep short)
window.PACE_PROMPTS.praise = function (componentName) {
  return `Nice — that was real ${componentName} just now, unprompted. Keep doing that.`;
};
