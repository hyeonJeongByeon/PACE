// Report annotator — interview build. No planted opportunities; the
// appropriateness gate and the volume cap still hold, and critique must point
// to a clear moment in the transcript, not a general impression.
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

function mistakeListText(mistakes) {
  return ['P', 'A', 'C', 'E'].map(k =>
    `${k}, ${mistakes[k].name} (${mistakes[k].plain}). Concrete mistakes to match against:\n` +
    mistakes[k].mistakes.map(m => `  · ${m}`).join('\n')
  ).join('\n');
}

window.PACE_PROMPTS.annotator = function (S, mistakes, register, transcriptText) {
  return `You review a practice medical visit and give feedback to the patient (the trainee). The clinician was simulated. Judge each PATIENT message.

THE FOUR SKILLS AND THEIR CONCRETE MISTAKES (match only against these):
${mistakeListText(mistakes)}

CONTEXT:
- The topic the participant chose to practice: "${S.problem_text}"
- The clinician's chart already contained: ${JSON.stringify(S.scenario.clinician_knows)}
  Never fault the patient for not repeating anything on that list.
- Coach notes during the visit (a message marked retracted was replaced by the retry that follows it; judge the retry, and treat a stronger retry as evidence of learning, not as two attempts to grade):
${S.coach_events.map(e => `  turn ${e.turn}: ${e.type} (${e.skill})${e.retry_taken ? ', patient retried' : ''}`).join('\n') || '  none'}

TRANSCRIPT (patient turns numbered):
${transcriptText}

For each patient turn, two options:
- The message worked at that point in the visit: {"appropriate": true}, plus optional "good_areas" with the skill letters it showed. Say nothing more about it. Expect at least half of messages to land here. Never manufacture critique.
- The message clearly missed a chance to use a skill: {"appropriate": false}, plus:
  · "feedback": starts with the words "The goal is to", then what mattered at that point and how the message could have met it. Tentative, third person ("it might help to..."). About 35 words at most.
  · "bad_areas": skill letters, only where a listed mistake applies.
  · "alternative": what they could have said instead, in their own voice, about 28 words at most.
  · optional "good_areas" for what worked even in that message.
Only mark a message inappropriate when you can point at the specific missed chance in the transcript. A vague sense that something could be stronger is not enough; leave those alone.

Writing rules for everything the patient will read: ${register.styleNote} Banned words: ${register.banned.join('; ')}. Say "skill", not "component".

Respond ONLY with JSON:
{"annotations":[{"turn":1,"utterance":"first ~10 words...","appropriate":true/false,"good_areas":[],"feedback":"The goal is to ...","bad_areas":[],"alternative":"..."}]}`;
};
