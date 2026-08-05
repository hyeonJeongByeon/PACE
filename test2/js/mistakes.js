// PACE per-component mistake lists — HANDOVER_SPEC_V2.md §7.4 — plus the §7.8
// participant-facing register rules (skill glosses + banned terms).
// *** DRAFTS: researcher must review with her advisor. ***
// One editable file, referenced by the annotation prompt AND the renderer.

window.PACE_MISTAKES = {
  P: {
    name: 'Present',
    gloss: 'Present (telling your story)',            // §7.8 first-use gloss
    plain: 'telling your story clearly and completely',
    mistakes: [
      'Burying the main concern mid-message or saving it for the end of the visit',
      'Describing a symptom without onset, duration, or severity',
      'Omitting what they have already tried and whether it helped — ONLY when treatment history is in clinician_does_not_know',
      'Not stating what they hope the visit can accomplish',
      'Letting a clinician misunderstanding stand uncorrected',
      'Answering only the literal question asked when relevant context exists that the clinician has no way to know',
    ],
  },
  A: {
    name: 'Ask',
    gloss: 'Ask (getting your questions answered)',
    plain: 'getting your questions answered',
    mistakes: [
      'Ending the visit with the survey\'s must-ask question still unasked',
      'Asking nothing when a test, medication, or plan is introduced (purpose, risks, alternatives, logistics)',
      'Bundling several questions into one turn so some get dropped',
      'Asking so vaguely that the answer cannot be useful',
      'Not prioritizing when time pressure is signaled, so the important question is displaced by a minor one',
    ],
  },
  C: {
    name: 'Check',
    gloss: 'Check (making sure you understood)',
    plain: 'making sure you understood',
    mistakes: [
      'Letting an undefined jargon term pass without asking what it means',
      'Signaling understanding ("okay", "got it") without demonstrating it',
      'Not restating instructions in their own words when a plan is given',
      'Not summarizing the agreed plan before the visit ends',
      'Not asking the clinician to repeat, slow down, spell, or write something down when lost',
    ],
  },
  E: {
    name: 'Express',
    gloss: 'Express (saying what\'s worrying you)',
    plain: 'saying what\'s worrying you',
    mistakes: [
      'Not voicing a stated worry from the survey (worry_level, suspected_cause) when the relevant topic comes up',
      'Agreeing to a plan while holding unspoken doubts about feasibility (cost, side effects, schedule, ability to follow through)',
      'Downplaying or retracting a concern after a dismissive clinician response',
      'Not saying so when the clinician\'s explanation did not address the actual concern',
      'Ending the visit with the emotional stakes never named',
    ],
  },
};

// §7.8 banned terms for ALL participant-facing output (pilot F3).
// Fed into the annotator + overview prompts; renderer templates avoid them too.
window.PACE_REGISTER = {
  readingLevel: '8th grade',
  banned: [
    'build-on moment', 'utterance', 'component', 'alignment', 'reinforcement',
    'intervention', 'trainee', 'elicit', 'psychosocial', 'behavioral',
  ],
  preferred: [
    ['a moment to improve', 'one place you could have pushed a little more'],
    ['incorrect response', 'a moment you might handle differently next time'],
    ['positive behavior', 'something you did really well'],
  ],
};
