// PACE per-component mistake lists — HANDOVER_SPEC.md §6.3.
// The detection backbone: the annotator matches against these concrete
// mistakes, not the abstract component labels.
// *** DRAFTS. The researcher must review and revise with her advisor,
// mirroring the expert co-design step in Chaszczewicz et al. (ACL 2024). ***
// Referenced by BOTH the annotation prompt and the report card renderer —
// edit here only.

window.PACE_MISTAKES = {
  P: {
    name: 'Present',
    plain: 'Explaining your situation clearly and completely',
    mistakes: [
      'Burying the main concern mid-message or saving it for the end of the visit',
      'Describing a symptom without onset, duration, or severity',
      'Omitting what they have already tried and whether it helped',
      'Not stating what they hope the visit can accomplish',
      'Letting a clinician misunderstanding stand uncorrected',
      'Answering only the literal question asked when relevant context exists that the clinician has no way to know',
    ],
  },
  A: {
    name: 'Ask',
    plain: 'Asking the questions you actually have',
    mistakes: [
      'Ending the visit with the must-ask question from the survey still unasked',
      'Asking nothing when a test, medication, or plan is introduced (purpose, risks, alternatives, logistics)',
      'Bundling several questions into one turn so some get dropped',
      'Asking so vaguely that the answer cannot be useful',
      'Not prioritizing when time pressure is signaled, so the important question is displaced by a minor one',
    ],
  },
  C: {
    name: 'Check',
    plain: 'Making sure you understood what the provider said',
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
    plain: 'Speaking up about worries and doubts',
    mistakes: [
      'Not voicing a stated worry from the survey (worry_level, suspected_cause) when the relevant topic comes up',
      'Agreeing to a plan while holding unspoken doubts about feasibility (cost, side effects, schedule, ability to follow through)',
      'Downplaying or retracting a concern after a dismissive clinician response',
      'Not saying so when the clinician\'s explanation did not address the actual concern',
      'Ending the visit with the emotional stakes never named',
    ],
  },
};
