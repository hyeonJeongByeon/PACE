// Stage 4 — substitution QA check (HANDOVER_SPEC.md §6.6).
// For each Level 3 item: substitute the generated alternative into the
// transcript and ask whether it would now be marked appropriate. Guards the
// known worst-case failure: alternatives that cosmetically rephrase the
// original without resolving the core issue.
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

window.PACE_PROMPTS.qaCheck = function (S, mistakes, transcriptText, turn, alternative, goalText) {
  return `Quality check for patient-communication feedback. In the practice-visit transcript below, patient turn ${turn} has been REPLACED with a suggested alternative. Judge the alternative in context.

TRANSCRIPT (with substitution at patient turn ${turn}):
${transcriptText}

SUBSTITUTED MESSAGE (patient turn ${turn}): "${alternative}"
THE FEEDBACK'S STATED GOAL for that moment: "${goalText}"

Would this substituted message be marked APPROPRIATE — does it actually achieve the stated goal at that point in the visit, rather than merely rephrasing what was originally said?

Respond ONLY with JSON: {"appropriate": true/false, "why": "one short sentence"}`;
};

// Regeneration prompt — used once when a Level 3 alternative fails the
// substitution check (§6.6: regenerate once; drop on second failure).
window.PACE_PROMPTS.qaRegen = function (transcriptText, turn, originalUtterance, goalText, failReason) {
  return `In this practice medical-visit transcript, the patient's turn ${turn} ("${originalUtterance}") needs a better suggested alternative.

TRANSCRIPT:
${transcriptText}

THE GOAL that the alternative must achieve: "${goalText}"
A previous suggestion failed this check because: "${failReason}"

Write ONE alternative message the patient could have sent at turn ${turn}: it must actually achieve the goal (not cosmetically rephrase the original), fit the conversation at that point, and sound like a real patient (~28 tokens, plain voice).

Respond ONLY with JSON: {"alternative":"..."}`;
};
