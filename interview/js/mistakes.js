// PACE skill definitions and mistake lists — interview build.
// Labels follow the original Cegala/AHA wording: Provide, Ask, Clarify, Express.
// *** Mistake lists are drafts; researcher reviews with advisor. ***

window.PACE_MISTAKES = {
  P: {
    name: 'Provide',
    gloss: 'Provide (sharing how you feel)',
    plain: 'sharing how you feel and what is going on',
    mistakes: [
      'Burying the main concern mid-message or saving it for the end of the visit',
      'Describing a symptom without when it started, how often, or how bad it gets',
      'Leaving out what they have already tried and whether it helped',
      'Not saying what they hope the visit can accomplish',
      'Letting a clinician misunderstanding stand uncorrected',
      'Answering only the literal question asked when there is context the clinician has no way to know',
    ],
  },
  A: {
    name: 'Ask',
    gloss: 'Ask (getting your questions answered)',
    plain: 'asking when you need more information',
    mistakes: [
      'Asking nothing when a test, medication, or plan is introduced (purpose, risks, alternatives, logistics)',
      'Bundling several questions into one message so some get dropped',
      'Asking so vaguely that the answer cannot be useful',
      'Letting the important question go unasked when time pressure is signaled',
    ],
  },
  C: {
    name: 'Clarify',
    gloss: 'Clarify (making sure you understand)',
    plain: 'making sure you understand what you hear',
    mistakes: [
      'Letting an unfamiliar medical term pass without asking what it means',
      'Saying "okay" or "got it" without showing what was understood',
      'Not repeating instructions back in their own words when a plan is given',
      'Not reviewing the agreed plan before the visit ends',
      'Not asking the clinician to repeat, slow down, or write something down when lost',
    ],
  },
  E: {
    name: 'Express',
    gloss: 'Express (saying what concerns you)',
    plain: 'saying what concerns you',
    mistakes: [
      'Holding back a worry when the relevant topic comes up',
      'Agreeing to a plan while keeping doubts quiet (cost, side effects, schedule, ability to follow through)',
      'Backing off a concern after the clinician brushes it aside',
      'Not saying so when the explanation did not address the actual concern',
      'Ending the visit with the biggest worry never named',
    ],
  },
};

// Register rules for all participant-facing generated text.
window.PACE_REGISTER = {
  readingLevel: '8th grade',
  styleNote: 'Write like a person talking to another person: plain words, short sentences. Never use em dashes (the — character). Never use the word "real" in any phrase (no "a real ask", "real skills", "a real foothold"). Avoid "actually", "genuinely", and coaching jargon.',
  banned: [
    'build-on moment', 'utterance', 'component', 'alignment', 'reinforcement',
    'intervention', 'trainee', 'elicit', 'psychosocial', 'behavioral',
  ],
};
