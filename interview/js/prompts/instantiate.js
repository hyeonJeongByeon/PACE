// Scenario + persona instantiation — interview build.
// Input is a single topic. The clinician is an ordinary, realistic provider;
// no scripted challenge behaviors and no planted opportunities. Whatever
// communication friction arises should feel natural to the situation.
// Researcher-editable.

window.PACE_PROMPTS = window.PACE_PROMPTS || {};

window.PACE_PROMPTS.instantiate = function (problemText, seed, register) {
  return `You set up a simulated medical visit for a patient communication practice tool. Build one scenario from the participant's topic and their chosen visit style.

TOPIC THE PARTICIPANT WANTS TO PRACTICE DISCUSSING:
"${problemText}"

VISIT STYLE THE PARTICIPANT CHOSE: "${seed.title}"
${seed.menuDescription}
CLINICIAN STYLE SEED: ${seed.persona_seed}

RULES:
- Low-acuity, non-alarming. Never introduce serious diagnoses, emergencies, or frightening possibilities. Never diagnose a real condition.
- Split the information: clinician_knows is the chart (topic-level facts a real chart would hold, written in plain language, since the participant will see this list). Everything about how it feels, how long, what has been tried, and what the patient hopes for belongs in clinician_does_not_know. That gap is what makes the practice work.
- The clinician is an ordinary, believable provider built from the style seed above. Keep the style realistic and mild, a person, not a caricature. When the patient asks, persists, or speaks up, the clinician responds well. That responsiveness is the point of the practice.
- opening_turn: greet and orient in one sentence, mention something from the chart so the visit feels booked in advance, and invite the patient to say more. Do not ask a question so broad that any answer works.
- premise: second person, 3 to 5 sentences, the moment before the exam room door opens.
- ${register.styleNote}

persona.principles must include these three verbatim:
- "You know only what is in your chart. Do not reference treatments, results, or history that are not in your chart. If you need information you do not have, ask for it."
- "Never give real medical advice; all clinical content stays within this fictional practice scenario."
- "Keep replies to 1 to 3 sentences of realistic spoken visit dialogue, with at most one unexplained medical term per reply."

Respond ONLY with JSON, no markdown:
{
  "scenario": {
    "premise": "...",
    "clinician_knows": ["..."],
    "clinician_does_not_know": ["..."],
    "opening_turn": "..."
  },
  "persona": {
    "display_name": "Dr. <lastname>",
    "description": "role, manner, communication habits, 2-3 sentences",
    "principles": ["..."]
  }
}`;
};
