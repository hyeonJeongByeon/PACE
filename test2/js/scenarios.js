// Scenario seeds + component→scenario assignment — HANDOVER_SPEC_V2.md §4.5, §6.1.
// NO scenario menu (§6.1; pilot F8): the seed is selected by assigned_component
// via the mapping below. Seeds are the v1 doctor personas, ported per the §9.2
// CONFIRM working resolution.
// Every challenge behavior ships with a sticky yield condition (§4.5; F6).
// Researcher-editable.

window.PACE_SCENARIO_SEEDS = {

  // §4.5 taxonomy mapping, component → challenge behaviors.
  // A has no spec-assigned behavior; time_pressure chosen because the A mistake
  // list targets question-displacement under time pressure. Flagged as a
  // working choice — revisit with advisor.
  COMPONENT_BEHAVIORS: {
    P: ['interrupts'],
    A: ['time_pressure'],
    C: ['jargon', 'vague_plan'],
    E: ['minimizes', 'time_pressure'],
  },

  // component → seed persona used for instantiation
  COMPONENT_SEED: { P: 'interrupter', A: 'rushed', C: 'confusing', E: 'dismissive' },

  YIELD_LIBRARY: {
    jargon: {
      behavior: 'jargon',
      description: 'Uses at most ONE undefined medical term per turn (never several).',
      yields_to: 'The patient asks what a term means, or asks for plain language — one in-fiction request is enough.',
      yielded_state: 'Explains in plain terms for the REST of the visit, and checks in once ("does that make sense?"). Never reverts.',
    },
    vague_plan: {
      behavior: 'vague_plan',
      description: 'Friendly but non-specific about next steps: no doses, timelines, or logistics unless pinned down.',
      yields_to: 'The patient asks for specifics (what exactly, when, how) or restates the plan to check it.',
      yielded_state: 'Gives concrete, complete specifics for the rest of the visit. Never reverts.',
    },
    minimizes: {
      behavior: 'minimizes',
      description: 'Brushes off or downplays a stated concern ("that\'s pretty common, I wouldn\'t worry").',
      yields_to: 'The patient persists: restates the worry directly, says it feels different, or asks for it to be taken seriously.',
      yielded_state: 'Engages the concern seriously — asks real follow-ups, addresses it in the plan. Never reverts.',
    },
    time_pressure: {
      behavior: 'time_pressure',
      description: 'Talks fast, signals the visit is short, moves to close early.',
      yields_to: 'The patient sets an agenda, prioritizes their must-ask question out loud, or holds the floor for a remaining item.',
      yielded_state: 'Slows down and gives the named items proper attention (may stay brisk in tone). Never reverts.',
    },
    interrupts: {
      behavior: 'interrupts',
      description: 'Redirects to a new question before the patient finishes their account.',
      yields_to: 'The patient completes their point anyway, returns to what they were saying, or names that they weren\'t finished.',
      yielded_state: 'Lets the patient finish from then on; asks "go on" instead of redirecting. Never reverts.',
    },
  },

  seeds: {
    dismissive: {
      id: 'dismissive', title: 'A provider who brushes things off',
      persona_seed: 'Pleasant but minimizing. Default move: normalize the concern and move on without probing. Not hostile — just quick to reassure and reluctant to dig.',
    },
    rushed: {
      id: 'rushed', title: 'A rushed visit',
      persona_seed: 'Competent and friendly but badly overbooked. Answers curtly, signals the visit is short, tries to close early. Takes seriously whatever the patient manages to get in.',
    },
    confusing: {
      id: 'confusing', title: 'A confusing explainer',
      persona_seed: 'Knowledgeable, efficient, talks the way they chart: clinical vocabulary, friendly but non-specific about next steps. On autopilot rather than unkind.',
    },
    interrupter: {
      id: 'interrupter', title: 'A provider who moves on too fast',
      persona_seed: 'Warm and well-meaning but redirects quickly — asks the next chart question before the patient has finished the last answer. The patient\'s full story only lands if they hold their ground.',
    },
  },
};
