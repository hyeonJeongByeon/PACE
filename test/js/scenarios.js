// Five scenario seeds — ported from the v1 prototype per HANDOVER_SPEC.md §4.3
// CONFIRM (working resolution: v1 personas used as seeds for tailoring).
// Stage 2 instantiates a concrete scenario from: chosen seed + survey answers
// + assigned_component. Challenge behaviors come from the handover taxonomy
// (§4.3, max 2 per session).
// Researcher-editable.

window.PACE_SCENARIO_SEEDS = [
  {
    id: 'dismissive',
    title: 'The dismissive visit',
    menuDescription: 'You bring up something that worries you, but the provider brushes it off without really looking into it.',
    challenge_behaviors: ['minimizes'],
    persona_seed: 'Pleasant but minimizing. Default move: normalize the concern ("that\'s really common, I wouldn\'t worry") and move on without probing. Not hostile — just quick to reassure and reluctant to dig.',
    yield_seed: 'Warms up and engages seriously when the patient persists, restates their worry directly, or presents concrete detail that makes the concern hard to wave away.',
  },
  {
    id: 'rushed',
    title: 'The rushed visit',
    menuDescription: 'The provider is running behind and keeps trying to wrap up before you\'ve gotten to everything you came for.',
    challenge_behaviors: ['time_pressure', 'interrupts'],
    persona_seed: 'Competent and friendly but badly overbooked. Answers curtly, signals the visit is short, redirects before the patient finishes, tries to close early. Takes things seriously — but only what the patient manages to get in.',
    yield_seed: 'Slows down and addresses items properly when the patient sets an agenda up front, holds the floor, or prioritizes their must-ask question out loud.',
  },
  {
    id: 'confusing',
    title: 'The confusing explanation',
    menuDescription: 'The provider explains things using medical terms you don\'t know, and the plan they give you is vague.',
    challenge_behaviors: ['jargon', 'vague_plan'],
    persona_seed: 'Knowledgeable, efficient, talks the way they chart: precise clinical vocabulary, no definitions, friendly but non-specific about next steps. On autopilot rather than unkind.',
    yield_seed: 'Explains clearly, in plain language and with concrete specifics, whenever the patient asks what a term means or pins down the plan.',
  },
  {
    id: 'hard-to-describe',
    title: 'The hard-to-describe problem',
    menuDescription: 'The provider is perfectly nice — but your issue is vague and hard to put into words, and it\'s on you to get it across.',
    challenge_behaviors: [],
    persona_seed: 'Warm, neutral, unhurried — no communication obstacles. Works with exactly what the patient gives: thin description keeps the assessment visibly generic; specifics sharpen it. Never guesses details the patient hasn\'t provided.',
    yield_seed: 'The assessment and plan become concrete and tailored once the patient presents onset, pattern, severity, and impact.',
  },
  {
    id: 'judgmental',
    title: 'The judgmental comment',
    menuDescription: 'You\'re in for something routine when the provider makes an off-topic comment about your lifestyle. It stings, and it\'s not what you came for.',
    challenge_behaviors: ['minimizes'],
    persona_seed: 'Brisk and confident; considers mild unsolicited lifestyle commentary part of good doctoring (KEEP IT MILD — one weight/lifestyle-adjacent remark delivered as helpfulness, never mocking, never repeated moralizing). If the patient names the comment or redirects, responds like a professional caught off guard but decent: brief acknowledgment, no doubling down, back to the agenda.',
    yield_seed: 'Returns fully to the patient\'s stated agenda — and stays there — once the patient names the moment or redirects to what they came for.',
  },
];
