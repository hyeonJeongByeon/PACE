// §8 — live tips: REINFORCEMENT-ONLY (resolved policy; pilot F11).
// Max 2 per session, only when an embedded opportunity is detected as met.
// Never corrective, never suggestive, never "you could also…".
// Canned templates (no LLM call — nothing to get wrong).
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

window.PACE_PROMPTS.liveTip = function (component) {
  const tips = {
    P: 'Nice — that was real storytelling. The doctor has the full picture now.',
    A: 'Nice — that was a real ask.',
    C: 'Nice — you just made sure you actually understood. That\'s the skill.',
    E: 'Nice — you said what was worrying you. That takes guts.',
  };
  return tips[component] || 'Nice — that was the real thing.';
};
