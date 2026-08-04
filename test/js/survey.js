// Pre-visit survey items — HANDOVER_SPEC.md §3.3, provenance tags preserved.
// Researcher-editable. [GR]=Getting Ready form, [PACE-GS]=Cegala Guide Sheet,
// [LEAPS]=Roter et al. 2024 Table 3, [NEW]=written for this prototype.

window.PACE_SURVEY = {

  partA: [
    { key: 'problem_text', type: 'text', required: true, source: '[GR item 1]',
      label: 'What is the main health issue or topic you want to practice discussing?',
      placeholder: 'e.g., headaches that keep coming back' },
    { key: 'problem_duration', type: 'select', required: true, source: '[GR item 1]',
      label: 'How long has this been going on?',
      options: ['Days', 'Weeks', 'Months', 'A year or more', 'Not applicable'] },
    { key: 'worry_level', type: 'scale05', required: true, source: '[GR item 4]',
      label: 'How worried are you about it?',
      minLabel: 'Not worried', maxLabel: 'Very worried' },
    { key: 'suspected_cause', type: 'text', required: false, source: '[GR item 9]',
      label: 'What do you think might be causing it, or what are you most worried it could be? (optional)',
      placeholder: '' },
    { key: 'visit_goal', type: 'text', required: true, source: '[PACE-GS]',
      label: 'What do you most hope the provider can do for you in this visit?',
      placeholder: 'e.g., figure out what’s causing it / adjust my treatment' },
    { key: 'must_ask_question', type: 'text', required: true, source: '[GR item 10, PACE-GS]',
      label: 'One question you do not want to forget to ask:',
      placeholder: '' },
  ],

  // Part B — component screener [LEAPS]. Scale Never / Sometimes / Often.
  screener: [
    { key: 's_p1', component: 'P', label: 'I did not get to explain my situation fully before the provider moved on' },
    { key: 's_p2', component: 'P', label: 'The provider misunderstood something I said' },
    { key: 's_a1', component: 'A', label: 'I left the visit with questions I never asked' },
    { key: 's_a2', component: 'A', label: 'I was not comfortable asking the provider questions' },
    { key: 's_c1', component: 'C', label: 'I did not understand what the provider told me but did not say so' },
    { key: 's_c2', component: 'C', label: 'The provider used medical terms that were confusing' },
    { key: 's_e1', component: 'E', label: 'I held back a worry because I felt rushed or dismissed' },
    { key: 's_e2', component: 'E', label: 'I agreed to a plan I was not sure I could follow' },
  ],
  screenerScale: ['Never', 'Sometimes', 'Often'],

  preferredFocus: {
    key: 'preferred_focus', required: true,
    label: 'Which would you most like to get better at?',
    options: [
      { value: 'P', label: 'Explaining my situation clearly and completely' },
      { value: 'A', label: 'Asking the questions I actually have' },
      { value: 'C', label: 'Making sure I understood what the provider said' },
      { value: 'E', label: 'Speaking up about worries or doubts about the plan' },
    ],
  },

  // Safety item — HANDOVER_SPEC.md §3.5, passed verbatim into the persona
  // prompt as a hard constraint.
  contentExclusions: {
    key: 'content_exclusions', required: false,
    label: 'Anything the practice scenario should avoid? (optional)',
    placeholder: 'topics, situations, or details you’d rather not role-play',
  },
};
