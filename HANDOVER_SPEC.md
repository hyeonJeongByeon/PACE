# PACE Prototype — Build Specification and Handover

**For** Claude Code
**From** a research design conversation, August 2026
**Project** PACE, a web-based patient communication training tool using an LLM-simulated clinician, a role-play engine, and a post-session report card

---

## 0. How to use this document

This is a design specification, not a finished requirements doc. Sections 1 through 4 are settled and should be implemented as written. Section 8 lists decisions the researcher has not made yet. Where this document says **CONFIRM**, do not guess. Ask before building, or build the simplest version behind a flag.

Assume the researcher (Hyeonjeong, PhD student, UW / Seattle Children's) will read your code and iterate. Prioritize legibility and swappable prompts over cleverness. Every prompt template should live in its own file, not inline in application logic, because these will be revised many times with an advisor.

---

## 1. What PACE is

PACE is a communication training intervention for patients. The name comes from Donald Cegala's PACE framework, which trains patients (not clinicians) to participate more effectively in medical visits.

The four components are

| Letter | Component | What the patient practices |
|---|---|---|
| **P** | Present / Prepare | Describing symptoms, history, and goals clearly and completely |
| **A** | Ask | Asking the questions they actually have, about diagnosis, tests, medications, and other treatments |
| **C** | Check | Verifying understanding by restating, summarizing, and asking for clarification |
| **E** | Express | Voicing concerns, doubts, and barriers to following a plan |

Cegala's original intervention was a mailed training booklet plus a one-page guide sheet filled out before the visit. It was entirely didactic and preparatory. It contained no role-play and no feedback.

**The prototype's contribution is exactly that gap.** PACE-the-prototype adds interactive rehearsal and structured post-session feedback to a framework whose original materials had neither. Keep this framing in mind, because it determines what has to work well. The role-play and the report card are the contribution. The instructional content is inherited.

---

## 2. System overview

Four stages, in order, one session end to end.

```
[1] Pre-visit survey
        |
        v
[2] Scenario + persona instantiation  (LLM, server-side)
        |
        v
[3] Role-play  (LLM, turn-capped, embedded opportunities)
        |
        v
[4] Report card  (LLM, three levels, organized by PACE component)
```

State to carry forward through all four stages

```
SessionState {
  session_id
  survey_responses        // from stage 1
  assigned_component      // P | A | C | E, from stage 1 scoring
  scenario                // from stage 2
  persona                 // from stage 2
  embedded_opportunities  // from stage 2, list of objects
  transcript              // from stage 3, list of turns
  turn_annotations        // from stage 3 or 4, per-user-turn classification
  report_card             // from stage 4
}
```

---

## 3. Stage 1 — Pre-visit survey

### 3.1 Purpose

Two jobs. First, gather enough clinical content to make the simulated visit fit the participant's actual situation. Second, determine which PACE component the scenario should stress.

### 3.2 Provenance

Items are drawn from two published, PACE-lineage instruments so the survey is citable rather than invented.

- **[GR]** Getting Ready form, Lussier and Richard team, CRCHUM. https://gettingready.ca/media/site/e639127028-1756326050/getting_ready_form_250513.pdf
- **[PACE-GS]** Cegala PACE Guide Sheet, OSU Wexner version. https://wexnermedical.osu.edu/-/media/files/wexnermedical/blog/2017pace.pdf
- **[LEAPS]** Roter et al. 2024, PEC Innovation, Table 3 problem-communication items. https://pmc.ncbi.nlm.nih.gov/articles/PMC11169459/
- **[NEW]** Written for this prototype. No published source. Flag these in any methods writeup.

### 3.3 Core items (implement all)

**Part A — Visit content.** Feeds scenario.

1. `problem_text` (free text) — What is the main health issue or topic you want to practice discussing? **[GR item 1]**
2. `problem_duration` (single select) — Days / Weeks / Months / A year or more / Not applicable **[GR item 1]**
3. `worry_level` (0 to 5 scale, labeled None to Very worried) **[GR item 4]**
4. `suspected_cause` (free text, optional) — What do you think might be causing it, or what are you most worried it could be? **[GR item 9]**
5. `visit_goal` (free text) — What do you most hope the provider can do for you in this visit? **[PACE-GS]**
6. `must_ask_question` (free text) — One question you do not want to forget to ask **[GR item 10, PACE-GS]**

**Part B — Component screener.** Feeds `assigned_component`. Response scale Never / Sometimes / Often. Items adapted from **[LEAPS]** Table 3.

| Key | Item | Maps to |
|---|---|---|
| `s_p1` | I did not get to explain my situation fully before the provider moved on | P |
| `s_p2` | The provider misunderstood something I said | P |
| `s_a1` | I left the visit with questions I never asked | A |
| `s_a2` | I was not comfortable asking the provider questions | A |
| `s_c1` | I did not understand what the provider told me but did not say so | C |
| `s_c2` | The provider used medical terms that were confusing | C |
| `s_e1` | I held back a worry because I felt rushed or dismissed | E |
| `s_e2` | I agreed to a plan I was not sure I could follow | E |

7. `preferred_focus` (single select, one of P / A / C / E, plain-language labels) — Which would you most like to get better at?

### 3.4 Scoring rule for `assigned_component`

```
score(component) = count of "Often" (weight 2) + count of "Sometimes" (weight 1)
                   across that component's two items
assigned_component = argmax(score)
tie-break 1: preferred_focus, if it is among the tied components
tie-break 2: preferred_focus outright
```

Store both the computed score vector and the final assignment. The researcher will want to inspect disagreement between screener and stated preference.

**CONFIRM** — the researcher has an existing challenge-cluster taxonomy derived from Prolific and ITHS survey data (roughly 117 finished responses). The mapping between that taxonomy and these four components has not been finalized. Build `assigned_component` as a single pluggable function so the cluster taxonomy can replace it without touching anything downstream.

### 3.5 Safety item (required)

8. `content_exclusions` (free text, optional) — Anything the practice scenario should avoid?

Pass verbatim into the persona prompt as a hard constraint. This matters because the study population is adolescents and young adults, some with cancer.

---

## 4. Stage 2 — Scenario and persona instantiation

### 4.1 Design principle, from the literature

Every LLM social-skill training system that produced measurable learning used the same three-layer recipe.

1. A **theory** constrains generation, rather than free-form role-play instructions
2. A **two-step pipeline** decides the behavioral move before writing the utterance
3. A **scenario** is a short second-person paragraph with a defined emotional starting state and an explicit termination condition

Sources: Rehearsal (Shaikh et al., CHI 2024), Roleplay-doh (Louie et al., 2024), CARE (Louie et al., CHI 2026).

### 4.2 Scenario object

```json
{
  "scenario_id": "...",
  "premise": "second-person paragraph, 3 to 5 sentences",
  "clinician_knows": ["facts from the survey the doctor has in the chart"],
  "clinician_does_not_know": ["facts the participant must supply themselves"],
  "opening_turn": "the clinician's first message",
  "target_component": "P | A | C | E",
  "embedded_opportunities": [ ... see 4.4 ]
}
```

The split between `clinician_knows` and `clinician_does_not_know` is the engine of the whole thing. Anything the participant must Present has to be withheld from the clinician. Anything the participant must Ask about has to be information the clinician possesses but does not volunteer.

### 4.3 Persona object

Model on Roleplay-doh's structure, which is a scenario description plus a list of natural-language behavioral principles. Roleplay-doh found that scenario-only prompting produced characters that were too articulate, too forthcoming, and too cooperative, and that explicit principles were needed to fix this.

```json
{
  "persona_id": "...",
  "description": "role, manner, time pressure, communication habits",
  "principles": [
    "Do not volunteer information about X unless directly asked.",
    "Use one piece of clinical jargon per response without defining it.",
    "..."
  ],
  "challenge_behaviors": ["max 2, selected from the taxonomy below"],
  "yield_condition": "what the participant must do for the clinician to change behavior"
}
```

**Challenge behavior taxonomy** (cap at two per session)

- `time_pressure` — talks fast, signals the visit is short
- `jargon` — uses undefined medical terms
- `interrupts` — redirects before the participant finishes
- `vague_plan` — friendly but non-specific about next steps
- `minimizes` — brushes off or downplays a stated concern

Match challenge behaviors to `assigned_component`. A C-component session should get `jargon` or `vague_plan`. An E-component session should get `minimizes` or `time_pressure`. A P-component session should get `interrupts`.

**CONFIRM** — the researcher has an existing HTML prototype with five doctor personas. Ask whether those should be ported, replaced, or used as the seed set for this generator.

### 4.4 Embedded opportunities

These are the measurable units. Each one is a moment where a specific PACE behavior would be correct and where its absence is detectable.

```json
{
  "id": "opp_1",
  "component": "C",
  "trigger": "clinician mentions 'we'll get a CBC and a CMP' without explaining",
  "expected_behavior": "participant asks what those tests are or restates to check understanding",
  "detected": false,
  "detected_at_turn": null
}
```

Generate three to five per session. At least two must target `assigned_component`. Distribute the rest across the other three so the report card has something to say about all four.

Detection can run live (cheap classifier per user turn) or in a single batch pass at the end. Batch is simpler and sufficient for a prototype. Structure the code so it can move to live later, since live detection is what would enable in-session coaching.

### 4.5 Prompt architecture, two-step

Do not ask the model to produce a clinician utterance in one shot. Follow the pattern validated by Rehearsal's IRP prompting and Roleplay-doh's principle-adherence pipeline.

**Step 1, plan.** Given the transcript, persona principles, remaining opportunities, and turn budget, decide the clinician's next move. Output a small structured object, not prose.

```
{ "move": "answer_partially | introduce_jargon | redirect | probe | close",
  "opportunity_to_open": "opp_3 | null",
  "reason": "one sentence" }
```

**Step 2, generate.** Write the utterance conditioned on the planned move and the persona principles.

**Optional step 3, adherence check.** Roleplay-doh found roughly 20 percent of one-shot GPT-4 responses violated expert principles or dialogue conventions. Their fix rewrites each principle into yes/no questions, checks applicability, and self-refines. Implement this behind a flag. Measure whether it is worth the latency before making it default.

### 4.6 The tuning target, stated plainly

Rehearsal's ablation is the single most useful empirical result for this build. Unconstrained LLM role-play was **too agreeable**, yielding to any strategy the user tried. Scoring without theory-grounded planning was **too stubborn**, never changing position regardless of what the user did. Only planning plus scoring together landed in what they called a practice goldilocks zone.

**The simulated clinician must yield to correct PACE behavior and not otherwise.** If it warms up regardless, the participant learns nothing. If it never warms up, the participant is demoralized. This is the hardest thing in the build. Budget iteration time for it and make the yield logic a first-class, inspectable piece of code rather than a prompt hope.

---

## 5. Stage 3 — Role-play engine

### 5.1 Hard constraints (already decided)

- **12 turns maximum, or 10 minutes, whichever comes first.** Show remaining turns to the participant.
- **The clinician sends the opening turn.** The participant never faces an empty box.
- **One assigned scenario per participant**, matched to their component. No scenario selection menu.

### 5.2 Opening turn design

Rehearsal's interlocutor begins in a defined non-neutral state and sends the first message. Do the same. The opening turn should

- greet and orient in one sentence
- reference something from `clinician_knows` so the visit feels continuous with the survey
- leave an obvious gap that invites the participant to Present
- not ask an open question so broad that any answer counts

**CONFIRM** — the researcher flagged prototype opening-turn behavior as an open item from a recent advisor meeting. Treat the above as a starting proposal, not a settled decision.

### 5.3 Termination

Two conditions, and they interact.

- **Budget termination** — turn 12 or minute 10. Always fires.
- **Behavioral termination** — the clinician reaches a satisfied or resolved state when the participant has met the yield condition.

Rehearsal ended sessions on a behavior-contingent score, not a turn count. This prototype uses a turn cap for study logistics. That is a defensible tradeoff but it has a consequence worth designing around. A participant who does everything right at turn 4 should get a visibly different ending than one who never engages the target behavior. Do not just cut both off at 12 with the same closing message.

Implement `resolution_state` as one of `resolved_early`, `resolved_at_cap`, `unresolved`. The report card should read differently for each.

### 5.4 Safety

- Filter `content_exclusions` into the persona prompt as a hard constraint
- The simulated clinician must never give real medical advice about the participant's actual condition. Add an explicit refusal principle to every persona.
- Persistent, visible framing that this is a practice simulation, not care
- A visible exit control on every screen, no confirmation friction
- Log nothing that is not needed. See section 7.

---

## 6. Stage 4 — Report card

### 6.1 Structure, already decided

Three levels, organized by PACE component.

```
Level 1  Session overview        one short paragraph, per-component status
Level 2  Component detail        for each of P, A, C, E, what happened
Level 3  Turn-level examples     specific moments, with alternatives
```

### 6.2 The feedback taxonomy (Chaszczewicz et al., ACL 2024, adapted to PACE)

This is the taxonomy behind CARE's feedback model, co-designed with senior psychotherapy supervisors (each 20+ years of supervision experience) and validated against how supervisors actually deliver post-session feedback. Their co-design found supervisors follow a consistent shape: positive reinforcement first, then a line-by-line pass over the transcript, and for each utterance needing work they clarify the goal at that point in the session, name the skill categories involved, and suggest an alternative response. Delivery matters as much as content. Their experts stressed phrasing feedback so the trainee can hear it without feeling judged.

Five components, applied per participant utterance.

1. **Appropriateness** — binary. Is this response appropriate and aligned with good PACE behavior at this point? **If yes, no further feedback is generated for that utterance.** Optionally tag which components it exemplified.
2. **Goal and Alignment** — natural-language statement of what the goal should be at this point in the visit, and how the response could better align with it. Always begins with the literal phrase "The goal is to". This component is the taxonomy's distinctive contribution. Explanation feedback outperforms correct-answer feedback for transfer of learning (Butler et al. 2013), which is why the goal text exists at all and why it precedes the alternative.
3. **Areas for Improvement** — one or more categories from a fixed list. For PACE the list is the four components plus their sub-mistakes (6.3), replacing their eight counseling categories.
4. **Alternative Goal-Aligned Response** — a concrete rewrite the participant could have sent, which must achieve the goal named in component 2.
5. **Positive Reinforcement** (optional) — categories the participant excelled at, even on utterances that also need improvement.

Per-utterance annotation object, matching their schema.

```json
{
  "utterance": "participant's message text",
  "appropriate": false,
  "good_areas": ["P"],
  "feedback": "The goal is to make sure the plan is actually understood before the visit ends. It would be better to restate the two instructions in your own words rather than saying okay.",
  "bad_areas": ["C"],
  "alternative": "So just to check I have this right, I take it twice a day with food, and I come back in two weeks even if I feel fine?"
}
```

Generation-order rule, keep it. In their fine-tuning data the goal-and-alignment text precedes the alternative deliberately, so the explanation guides the rewrite rather than rationalizing it after the fact. Preserve that ordering in the prompt and in any structured output schema.

Length calibration, from their dataset statistics. Average alternative response, 28.3 tokens. Average goal-and-alignment text, 36.6 tokens. In their base rates 57.7 percent of utterances were marked appropriate. Enforce brevity in the prompt and clamp in code. If generated feedback runs long, that is a defect, not thoroughness.

### 6.3 Per-component mistake lists — the detection backbone

The single most load-bearing part of their annotation prompt was an appendix enumerating, for each skill category, the concrete mistakes novices make. The category labels alone are too abstract for reliable detection. The mistake lists are what the model actually matches against.

PACE needs the equivalent. Seed lists below, written for this handover from the AHA PACE training content, the LEAPS problem-communication items, and the Getting Ready form. **These are drafts. The researcher must review and revise them with her advisor, mirroring the expert co-design step in the source paper. Store them in one editable file, referenced by both the annotation prompt and the report card renderer.**

**P — Present**
- Burying the main concern mid-message or saving it for the end of the visit
- Describing a symptom without onset, duration, or severity
- Omitting what they have already tried and whether it helped
- Not stating what they hope the visit can accomplish
- Letting a clinician misunderstanding stand uncorrected
- Answering only the literal question asked when relevant context exists that the clinician has no way to know

**A — Ask**
- Ending the visit with the must-ask question from the survey still unasked
- Asking nothing when a test, medication, or plan is introduced (purpose, risks, alternatives, logistics)
- Bundling several questions into one turn so some get dropped
- Asking so vaguely that the answer cannot be useful
- Not prioritizing when time pressure is signaled, so the important question is displaced by a minor one

**C — Check**
- Letting an undefined jargon term pass without asking what it means
- Signaling understanding ("okay", "got it") without demonstrating it
- Not restating instructions in their own words when a plan is given
- Not summarizing the agreed plan before the visit ends
- Not asking the clinician to repeat, slow down, spell, or write something down when lost

**E — Express**
- Not voicing a stated worry from the survey (worry_level, suspected_cause) when the relevant topic comes up
- Agreeing to a plan while holding unspoken doubts about feasibility (cost, side effects, schedule, ability to follow through)
- Downplaying or retracting a concern after a dismissive clinician response
- Not saying so when the clinician's explanation did not address the actual concern
- Ending the visit with the emotional stakes never named

### 6.4 Annotation prompt, adapted skeleton

Model on their Appendix I prompt. Do not copy their counseling prompt. Write the PACE version with this structure.

1. Role framing — you give feedback to a patient practicing for a medical visit; the two roles are patient (the trainee) and clinician (simulated).
2. Two options per utterance. Option I, response is good, set `appropriate` true and optionally tag `good_areas`. Option II, response could improve, set false and produce Parts A, B, C.
3. Part A, goal and alignment. Must start "The goal is to". Then the improvement, phrased tentatively and in third person — "it might be better to", "it could help to". Their prompt explicitly bans "the helper did X" phrasing, requires varying the stock phrases within one annotation set, and permits quoting short fragments of the dialogue.
4. Part B, areas, selected only from the mistake lists in 6.3, which are pasted into the prompt in full.
5. Part C, alternative, which must achieve the Part A goal in the participant's plausible voice, not an idealized clinical register.
6. Context rule — judge each utterance against everything earlier in the conversation, plus the survey-derived scenario facts (visit_goal, must_ask_question, worry_level), which their setting did not have and PACE does. This is PACE's advantage. Use it. An unasked must_ask_question is only detectable because the survey captured it.
7. Tone rule, added by their experts after pilots flagged the output as stuffy and clinical — professional and friendly language, focused on what is most beneficial for the trainee to hear.
8. Output JSON only, matching the 6.2 schema.

Their engineering note on context windows. Annotating a whole conversation in one call degraded quality on the final utterances, so they annotated overlapping five-utterance chunks and discarded feedback for the first two utterances of each chunk, which lacked context. A PACE session has at most six participant turns, so a single call is probably fine, but write the annotator to accept an utterance range so chunking is trivial to add.

### 6.5 From annotations to the report card

The annotator produces per-utterance objects. The report card is an aggregation over them, and the aggregation is where the volume cap lives.

```
annotations
  -> join with embedded_opportunities (was each opportunity met?)
  -> group inappropriate utterances by component (bad_areas)
  -> select ONE representative per component
     priority: linked to an embedded opportunity > earliest occurrence
  -> Level 3 = up to four goal / gap / alternative items
  -> Level 2 = per component: opportunities met, good_areas counts, one-line status
  -> Level 1 = short overview conditioned on resolution_state and assigned_component
```

### 6.6 QA self-check before rendering

Adapt their self-scoring mechanism as an inference-time filter. For each Level 3 item, substitute the generated alternative into the transcript in place of the original utterance and ask the annotator model whether the substituted response would be marked appropriate. If not, regenerate once. If it fails again, drop the item rather than show it.

The rationale is their explicit optimization target, worst-case rather than average performance, because in a high-stakes training context one piece of bad feedback costs more than one missing piece. Their qualitative analysis of worst-case failures found a specific signature worth guarding against: alternatives that slightly rephrase the original response without resolving the core issue. The substitution check catches exactly this, since a cosmetic rewrite will fail the appropriateness test for the same reason the original did.

### 6.7 Volume cap (important, do not skip)

CARE participants who received corrective feedback on most of their responses reported feeling demoralized and questioned whether they could ever satisfy the system. One said it felt like nothing would ever be right.

The authors' own recommended fix, which this prototype should implement directly, is to **cluster errors by type and present one representative example per class with a concrete alternative.**

Concrete rules

- Maximum **one** Level 3 item per PACE component. Four total, absolute ceiling.
- Every component with any positive evidence gets its strength named first, before any gap.
- If a component had no embedded opportunity, say so plainly rather than inventing a critique.
- Never render a report card that is entirely negative. If the participant met nothing, lead with effort and specificity of engagement, and give a single highest-leverage item.

### 6.8 Timing

Ex-post, after the role-play ends. No in-session coaching in v1.

Rationale, and it is worth writing into the paper. Post-practice feedback mirrors human supervision by preserving learner agency during the conversation while supporting reflection afterward. Just-in-time suggestion systems have been shown to distract learners and foster overreliance, sometimes producing negative learning effects when the AI support is withdrawn.

**Note the open research question.** CARE explicitly names session-level summary versus per-utterance feedback as an untested experimental contrast. Nobody has run it. If PACE ships both a report card and, later, a mid-session variant, that comparison is a genuine contribution rather than an inherited design. Build the report card generator so it can be re-pointed at a partial transcript.

### 6.9 Optional, only if sessions repeat

The one pre-LLM finding that directly A/B tested summary feedback design (Tanaka et al., automated social skills training) found that feedback comparing the user to their own previous training session was rated significantly higher than feedback without it, more than the summary format itself. If PACE ever becomes multi-session, longitudinal comparison is the highest-value addition to the report card.

---

## 7. Data handling, compliance, and repository hygiene

These are firm.

- **No participant data in the public GitHub repo.** Not in fixtures, not in tests, not in example JSON, not in commit history. Add a pre-commit check.
- Use synthetic personas and synthetic transcripts for all fixtures and demos.
- API keys never reach the client. All model calls go through the serverless proxy.
- **CONFIRM the model backend before writing the client.** Two paths have been in play. A public-facing path using the Anthropic API through a serverless proxy, and a Seattle Children's path using Vertex AI on GCP inside a BAA-covered project (`Dev-Cancer-Med-Health-Chatbot`). These have different auth, different data-residency implications, and different allowable content. Write a single `LLMClient` interface with two adapters. Do not hardcode either.
- Transcripts are research data. Store separately from application state, with an explicit retention decision recorded in the repo.
- Structured logging of `SessionState` transitions, because the researcher will need to reconstruct sessions for analysis.

---

## 8. Open decisions — ask, do not guess

1. Backend model path, Anthropic API versus Vertex AI, or both (section 7)
2. Whether the existing five HTML-prototype doctor personas are ported, replaced, or used as seeds (4.3)
3. Mapping from the existing Prolific / ITHS challenge-cluster taxonomy onto P / A / C / E (3.4)
4. Opening-turn behavior, flagged as an open advisor item (5.2)
5. Whether the pre-visit survey is administered in-app or externally, for example in Qualtrics, with results imported
6. Whether report card content is shown on screen only, or exportable by the participant
7. Session count, single-session or repeated, which determines whether 6.9 is in scope

---

## 9. Build order

Do it in this order. Each step is independently demonstrable.

1. **Skeleton and state.** `SessionState`, routing, the four stage shells, `LLMClient` interface with a mock adapter. No model calls.
2. **Survey.** All items from section 3, scoring function, component assignment. Fully testable with no LLM.
3. **Scenario and persona generation.** Two-step prompt architecture, prompts in separate files. Verify by hand against five synthetic survey inputs.
4. **Role-play, single turn.** Opening turn, one exchange, turn counter, hard cap. Get the yield behavior right here before adding anything else.
5. **Embedded opportunity detection.** Batch pass at end of session.
6. **Report card.** Build in the order of section 6's pipeline: per-utterance annotator (6.2, 6.4) with the mistake lists (6.3) in a standalone editable file, then aggregation (6.5), then the substitution QA check (6.6), then rendering with the volume cap enforced in code and not merely requested in the prompt (6.7). Test the annotator against hand-written synthetic transcripts with known planted mistakes before wiring it to live sessions.
7. **Safety and logging pass.** Exclusions, refusal principles, exit control, retention.
8. **Adherence-check pipeline** behind a flag (4.5, step 3). Measure before enabling.

---

## 10. Reference list

Cited in this spec, all reachable.

**PACE lineage**
- Cegala, McClure, Marinelli, Post (2000). The effects of communication skills training on patients' participation during medical interviews. Patient Educ Couns 41, 209-222.
- Cegala et al. (2000). The effects of patient communication skills training on compliance. Arch Fam Med 9(1), 57-64.
- PACE Guide Sheet, OSU Wexner. https://wexnermedical.osu.edu/-/media/files/wexnermedical/blog/2017pace.pdf
- AHA PACE training content, used with Cegala's permission. https://www.heart.org/en/health-topics/cardiac-rehab/communicating-with-professionals/preparing-for-medical-visits
- Getting Ready form. https://gettingready.ca/media/site/e639127028-1756326050/getting_ready_form_250513.pdf
- D'Agostino et al. (2017). Promoting patient participation through communication skills training, a systematic review. PMC5466484. Organizes all prior interventions by the four PACE elements.
- Roter et al. (2024). Online communication skill training of patients with cancer. PMC11169459. LEAPS items, Table 3.

**LLM role-play and feedback**
- Shaikh, Chai, Gelfand, Yang, Bernstein (2024). Rehearsal, Simulating Conflict to Teach Conflict Resolution. CHI '24. https://arxiv.org/abs/2309.12309 — IRP prompting, scenario appendix, agreeable-versus-stubborn ablation
- Louie, Nandi, Fang, Chang, Brunskill, Yang (2024). Roleplay-doh. https://arxiv.org/abs/2407.00870 — full prompt appendix, principle elicitation, principle-adherence pipeline. Code at https://roleplay-doh.github.io/
- Louie, Shah, Hasan Orney, Pacheco, Brunskill, Yang (2026). Can LLM-Simulated Practice and Feedback Upskill Human Counselors? CHI '26. https://arxiv.org/abs/2505.02428 — feedback structure, demoralization finding, ex-post rationale, practice-alone harm
- Chaszczewicz, Shah, Louie, Arnow, Kraut, Yang (2024). Multi-Level Feedback Generation with LLMs for Empowering Novice Peer Counselors. ACL 2024, pages 4130-4161. The feedback taxonomy underlying CARE, now fully incorporated into sections 6.2 through 6.6. Code at https://github.com/SALT-NLP/counseling-feedback. The FeedbackESConv dataset (400 annotated conversations) is public and useful as a formatting reference for annotation fixtures. Their Appendix I contains the full GPT-4 annotation prompt whose structure section 6.4 adapts, and their Table 4 contains the per-category mistake lists whose pattern section 6.3 follows.
- Lin, Sharma, Rytting, Miner, Suh, Althoff (2024). IMBUE. ACL 2024. https://aclanthology.org/2024.acl-long.47/ — DEAR MAN rubric, skill mastery was the only outcome that transferred
- Yang, Ziems, Held, Shaikh, Bernstein, Mitchell (2024). Social Skill Training with Large Language Models. https://arxiv.org/abs/2404.04204 — the AI Partner plus AI Mentor framing

**Feedback theory, for the writeup**
- Hattie and Timperley (2007). The Power of Feedback. Feed-up, feed-back, feed-forward. This is the structure behind goal-gap-alternative.
- Kluger and DeNisi (1996). Feedback intervention theory. Why the report card is organized by component rather than by global judgment of the person.
- Tannenbaum and Cerasoli (2013). Do team and individual debriefs enhance performance? Human Factors. The canonical evidence that structured post-event debriefs work, from outside medicine.
