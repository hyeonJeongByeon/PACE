# PACE Prototype — Build Specification and Handover (v2)

**For** Claude Code
**From** a research design conversation (August 2026), revised after Pilot 1 (2026-08-06)
**Project** PACE, a web-based patient communication training tool using an LLM-simulated clinician, a role-play engine, and a post-session report card
**Supersedes** PACE-prototype-handover.md (v1)

---

## 0. How to use this document

This is a design specification, not a finished requirements doc. Sections 1 through 6 are settled and should be implemented as written. Section 9 lists decisions the researcher has not made yet. Where this document says **CONFIRM**, do not guess. Ask before building, or build the simplest version behind a flag.

Assume the researcher (Hyeonjeong, PhD student, UW / Seattle Children's) will read your code and iterate. Prioritize legibility and swappable prompts over cleverness. Every prompt template lives in its own file, not inline in application logic, because these will be revised many times with an advisor.

**What changed since v1.** A pilot test with a labmate (37 min, think-aloud, 2026-08-06) exposed several places where the deployed prototype diverged from the v1 spec, and several places where the v1 spec was silent. This version:

1. Makes conformance to the report-card pipeline (Section 7) a hard requirement, because the pilot's worst moments were all violations of rules v1 already contained.
2. Adds a strict **opportunity-anchoring rule** for critique (7.5).
3. Adds **plain-language register requirements** for all participant-facing coach text (7.8).
4. Adds **screener-calibrated feedback intensity** (7.7).
5. Resolves the in-session coaching question: reinforcement-only live tips, all corrective content ex-post (Section 8).
6. Fixes the **information-continuity contract** between survey, clinician chart, persona, and annotator (4.3), which caused three separate pilot confusions.
7. Redesigns session **termination** as a soft close with visible time pressure (6.4).
8. Tightens the survey (3.6) and onboarding (5.1) based on pilot feedback.
9. Re-asserts that `assigned_component` is screener-driven, with `preferred_focus` as tie-breaker only (3.4). **The deployed pilot build appears to have let the participant's selection drive the focus directly and let them pick the scenario from a menu. Both are v1 violations. Audit and fix before anything else.**

A findings-to-spec map is in Section 1. Read it first; it is the rationale for most of the diffs.

---

## 1. Pilot 1 findings and where this spec addresses them

| # | Pilot finding | Root cause | Fixed in |
|---|---|---|---|
| F1 | Report card critiqued a well-executed Present ("could be strengthened... not quite all the way"), which the participant experienced as picking and the researcher called "comments for the sake of giving comments" | Annotator generated critique unanchored to any planted opportunity; appropriateness gate and volume cap not enforced in the deployed build | 7.2, 7.5, 7.6 |
| F2 | Participant assumed pre-visit survey content was already in the doctor's chart; coach faulted her for not re-presenting it; researcher agreed the flow was redundant | `clinician_knows` / `clinician_does_not_know` split not implemented, or not shared with the annotator | 4.3 |
| F3 | Report card used trainer jargon ("one build-on moment") the participant could not parse | No participant-facing register requirement | 7.8 |
| F4 | Coach assumed a low-awareness patient; a high-skill participant found it repetitive ("this coach doesn't work that well with me... if you're targeting someone who really needs to practice, it's definitely helpful") | One-size-fits-all feedback intensity | 7.7 |
| F5 | Clinician referenced "the last medication" and route-of-administration details the participant never entered and could not know | Persona invented chart facts outside `clinician_knows` | 4.3, 4.6 |
| F6 | Clinician used heavy undefined jargon; participant had to type "can you explain everything jargony in plain terms" and said "I feel like I'm instructing a chatbot" | Jargon challenge behavior had no yield condition wired to it | 4.5, 6.3 |
| F7 | Session ended abruptly at time; participant unsure whether to close it herself or wait to be "transferred out"; she noted real visits feel rushed but do not hard-stop ("I would keep my provider there... but I still feel this rush") | Budget termination implemented as a hard cut with no wrap-up phase | 6.4 |
| F8 | Participant chose her scenario from a menu; the discussion of one-focus-vs-all-four only makes sense if her selection drove the session | Deployed build promoted `preferred_focus` to assignment driver and exposed a scenario menu | 3.4, 6.1 |
| F9 | Intro page felt long; researcher plans to read it aloud in interview sessions; participant unsure whether coach tips arrive as messages or voice | Onboarding not designed for facilitated sessions | 5.1 |
| F10 | Participant preferred structured options over free text ("if I enter text I might miss something") | Survey leans on free text for recall-heavy content | 3.6 |
| F11 | Live coach tips existed in the deployed build although v1 Section 6.8 specified ex-post only; the one live tip the participant reacted well to was positive reinforcement ("Nice, that was a real ask"), not correction | Build/spec divergence; v1 never resolved the tension | Section 8 |

Positive pilot findings to preserve: the pre-visit summary was liked ("it's saying what I just typed and it's more clear" — it also supplied vocabulary she was searching for); the scenario premises were seen as relatable; the clinician's plain-language explanation *after* being asked was liked; the downloadable/printable summary was appreciated. Do not regress these.

---

## 2. What PACE is

PACE is a communication training intervention for patients. The name comes from Donald Cegala's PACE framework, which trains patients (not clinicians) to participate more effectively in medical visits.

| Letter | Component | What the patient practices |
|---|---|---|
| **P** | Present / Prepare | Describing symptoms, history, and goals clearly and completely |
| **A** | Ask | Asking the questions they actually have, about diagnosis, tests, medications, and other treatments |
| **C** | Check | Verifying understanding by restating, summarizing, and asking for clarification |
| **E** | Express | Voicing concerns, doubts, and barriers to following a plan |

Cegala's original intervention was a mailed training booklet plus a one-page guide sheet filled out before the visit. It was entirely didactic and preparatory. It contained no role-play and no feedback.

**The prototype's contribution is exactly that gap.** The role-play and the report card are the contribution. The instructional content is inherited.

Two framing points that now carry design weight:

- **The audience is patients, not professional trainees.** Nearly all comparable LLM training systems (CARE, SimPatient, IMBUE, Rehearsal) train counselors or clinicians, who expect critique. PACE's users include adolescents and young adults, some with cancer, whose baseline is anxiety and low entitlement to speak up. In the pre-LLM patient-side lineage (Belkora's question-listing coaching, Consultation Planning), the primary outcomes were **self-efficacy and reduced anxiety**, not error correction. The coach's job is to leave the participant more willing to speak up at their next real visit. Every feedback decision in Section 7 should be read against that goal.
- **Feedback is not an add-on.** CARE's randomized study found that practice with simulated patients *without* structured feedback harmed some outcomes (empathy decline). The report card is what makes the role-play safe to deploy, which is why pipeline conformance (Section 7) is a hard requirement rather than a quality aspiration.

---

## 3. Stage 1 — Pre-visit survey

### 3.1 Purpose

Two jobs. First, gather enough clinical content to make the simulated visit fit the participant's actual situation. Second, determine which PACE component the scenario should stress.

### 3.2 Provenance

Items are drawn from published, PACE-lineage instruments so the survey is citable rather than invented.

- **[GR]** Getting Ready form, Lussier and Richard team, CRCHUM
- **[PACE-GS]** Cegala PACE Guide Sheet, OSU Wexner version
- **[LEAPS]** Roter et al. 2024, PEC Innovation, Table 3 problem-communication items
- **[NEW]** Written for this prototype. No published source. Flag these in any methods writeup.

### 3.3 Core items (implement all)

**Part A — Visit content.** Feeds scenario.

1. `problem_text` (free text) — What is the main health issue or topic you want to practice discussing? **[GR item 1]**
2. `problem_duration` (single select) — Days / Weeks / Months / A year or more / Not applicable **[GR item 1]**
3. `worry_level` (0 to 5 scale, labeled None to Very worried) **[GR item 4]**
4. `suspected_cause` (free text, optional) — What do you think might be causing it, or what are you most worried it could be? **[GR item 9]**
5. `visit_goal` (free text) — What do you most hope the provider can do for you in this visit? **[PACE-GS]**
6. `must_ask_question` (free text) — One question you do not want to forget to ask **[GR item 10, PACE-GS]**
7. `current_treatments` (structured list, optional) **[NEW, added from pilot F5]** — Medications or treatments you are currently using or have tried for this problem. Each entry: free-text name (participants often do not know exact drug names; "the oral one my dermatologist gave me" is valid), a tried/currently-using toggle, and an optional "did it help" select (Helped / Didn't help / Made things worse / Not sure). This exists because follow-up-visit scenarios collapse without it: the clinician must be able to reference prior treatment without inventing it (F5), and treatment questions are among the most common things patients want to practice asking.

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

8. `preferred_focus` (single select, one of P / A / C / E, plain-language labels) — Which would you most like to get better at?

### 3.4 Scoring rule for `assigned_component` — audit the deployed build against this

```
score(component) = count of "Often" (weight 2) + count of "Sometimes" (weight 1)
                   across that component's two items
assigned_component = argmax(score)
tie-break 1: preferred_focus, if it is among the tied components
tie-break 2: preferred_focus outright
```

`preferred_focus` is a **tie-breaker and a research variable, not the assignment mechanism.** Store the computed score vector, the stated preference, and the final assignment; the researcher wants to inspect disagreement between behavioral self-report and stated preference.

**Audit note (F8).** The pilot build appears to have used the participant's explicit selection as the focus and skipped screener scoring. If so, the screener data collected so far is decorative and the challenge-behavior matching (4.5) is keyed to nothing. Implement the rule above, and log both values on every session.

Also compute and store `screener_total` = sum of all eight item scores (range 0–16). Section 7.7 consumes it.

**CONFIRM** — the researcher has an existing challenge-cluster taxonomy derived from Prolific and ITHS survey data (~117 responses). The mapping onto P/A/C/E is not finalized. Keep `assigned_component` a single pluggable function.

### 3.5 Safety item (required)

9. `content_exclusions` (free text, optional) — Anything the practice scenario should avoid?

Pass verbatim into the persona prompt as a hard constraint. The study population is adolescents and young adults, some with cancer.

### 3.6 Format rules (pilot F10)

- Wherever an item asks the participant to *recall* rather than *narrate* (duration, worry, treatment history, screener), use structured options. Free text is reserved for content that must be in the participant's own words (`problem_text`, `visit_goal`, `must_ask_question`, `suspected_cause`).
- For the remaining free-text items, add one line of example prompts under the field (e.g., under `problem_text`: "when it started, how bad it gets, what it stops you from doing") so options can serve as memory cues without constraining the answer. The pilot participant's stated worry was forgetting aspects of her condition when facing a blank text box.
- Survey length is fine as-is per the pilot; do not add items beyond this spec.

---

## 4. Stage 2 — Scenario and persona instantiation

### 4.1 Design principle, from the literature

Every LLM social-skill training system that produced measurable learning used the same three-layer recipe: a **theory** constrains generation; a **two-step pipeline** decides the behavioral move before writing the utterance; a **scenario** is a short second-person paragraph with a defined emotional starting state and an explicit termination condition. (Rehearsal, CHI 2024; Roleplay-doh, 2024; CARE, CHI 2026.)

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

### 4.3 The information-continuity contract (upgraded to hard requirement; pilot F2, F5)

The `clinician_knows` / `clinician_does_not_know` split is the engine of the whole system, and the pilot showed what happens when it is loose: the coach faulted the participant for not re-presenting information the clinician visibly already had (F2), and the clinician invented chart facts the participant never entered (F5).

Four rules, enforced in code and prompts:

1. **Exhaustive partition.** Every survey-derived fact is assigned to exactly one of the two lists at scenario generation time. Nothing is left implicit.
2. **The persona prompt receives `clinician_knows` as its complete chart.** Add an explicit persona principle: *"You know only what is in your chart. Do not reference prior treatments, test results, or history that are not in your chart. If you need information you do not have, ask for it."* This kills F5.
3. **The annotator receives both lists.** No Present critique may be generated for a fact in `clinician_knows` (the clinician already had it), and no Ask critique for information in neither list (the participant could not have known to ask). This kills F2 at the report-card layer.
4. **P-targeted sessions withhold deliberately.** Anything the participant must Present goes in `clinician_does_not_know`; anything they must Ask about is information the clinician possesses but does not volunteer. If `assigned_component` is P, at least two substantive survey facts must be withheld from the chart so Present opportunities exist at all. Conversely, if nearly everything is in `clinician_knows` (e.g., a tight follow-up scenario), the generator must not plant P opportunities it cannot support — see 4.4.

Show the participant what the doctor already knows. The scenario screen should include a short "What's in your chart" box rendered from `clinician_knows`. The pilot participant's mental model ("I'm assuming those boxes are known by the doctor already") was reasonable; the system should make the model explicit instead of leaving it to be guessed.

### 4.4 Embedded opportunities

Each opportunity is a moment where a specific PACE behavior would be correct and its absence is detectable.

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

Generate three to five per session. At least two must target `assigned_component`. Distribute the rest across the other components **subject to the continuity contract in 4.3** — an opportunity may only be planted where the information geometry supports it. It is acceptable, and now expected, for some sessions to have zero opportunities for some component; the report card has explicit language for that case (7.6) instead of an invented critique.

Detection runs as a single batch pass at session end. Structure the code so it can move to live later.

### 4.5 Persona object and challenge behaviors

Model on Roleplay-doh's structure: description plus natural-language behavioral principles. Scenario-only prompting produces characters that are too articulate, too forthcoming, and too cooperative.

```json
{
  "persona_id": "...",
  "description": "role, manner, time pressure, communication habits",
  "principles": ["...", "..."],
  "challenge_behaviors": ["max 2, from the taxonomy below"],
  "yield_conditions": [
    { "behavior": "jargon", "yields_to": "participant asks for plain language or asks what a term means", "yielded_state": "explains in plain terms for the rest of the visit, checks in once ('does that make sense?')" }
  ]
}
```

**Challenge behavior taxonomy** (cap at two per session), matched to `assigned_component`:

- `time_pressure` — talks fast, signals the visit is short (E sessions)
- `jargon` — uses undefined medical terms (C sessions)
- `interrupts` — redirects before the participant finishes (P sessions)
- `vague_plan` — friendly but non-specific about next steps (C sessions)
- `minimizes` — brushes off or downplays a stated concern (E sessions)

**Every challenge behavior ships with a yield condition, and yielding is sticky (pilot F6).** In the pilot, the jargon behavior had no wired yield: the clinician kept producing undefined terms until the participant issued a meta-instruction ("explain everything jargony in plain terms"), which broke immersion — she said it felt like instructing a chatbot rather than talking to a doctor. The correct dynamic: one in-fiction request ("what does that mean?" / "can you say that in plain words?") flips the behavior off for the remainder of the session. The participant should never need to step outside the fiction to change the clinician's behavior. This *is* the training target — the yield is the reward for doing the PACE behavior.

Calibrate jargon density: one undefined term per clinician turn at most (the v1 principle), not several. The pilot clinician exceeded this.

**CONFIRM** — the researcher has an existing HTML prototype with five doctor personas. Ported, replaced, or seed set?

### 4.6 Prompt architecture, two-step

Do not produce a clinician utterance in one shot.

**Step 1, plan.** Given the transcript, persona principles, `clinician_knows`, active/yielded challenge behaviors, remaining opportunities, and turn budget, decide the next move as a small structured object:

```
{ "move": "answer_partially | introduce_jargon | redirect | probe | begin_wrapup | close",
  "opportunity_to_open": "opp_3 | null",
  "reason": "one sentence" }
```

`begin_wrapup` is new; see 6.4.

**Step 2, generate.** Write the utterance conditioned on the planned move, the persona principles, and the chart constraint from 4.3 rule 2.

**Optional step 3, adherence check** (Roleplay-doh's pipeline), behind a flag. Measure latency cost before defaulting on. Add one adherence question specific to F5: *"Does this utterance reference any clinical fact not present in the chart or earlier in this conversation?"*

### 4.7 The tuning target, stated plainly

Rehearsal's ablation: unconstrained role-play is too agreeable; scoring without planning is too stubborn; only planning plus scoring lands in the practice goldilocks zone. **The simulated clinician must yield to correct PACE behavior and not otherwise.** Make the yield logic first-class, inspectable code, not a prompt hope. Budget iteration time here.

---

## 5. Onboarding and instructions (new section; pilot F9)

### 5.1 Facilitated vs. self-serve modes

The formative study runs facilitated (researcher present on a call). Later deployment may be self-serve. Build one flag: `session_mode: facilitated | self_serve`.

- **Facilitated:** instruction screens are minimal. One short screen per stage with only what the participant must read themselves (their own scenario premise, their chart box, the pre-visit summary). Everything explanatory is moved to a facilitator script (a separate markdown file in the repo, versioned with the prompts) that the researcher reads aloud. The pilot participant's suggestion, adopted: "maybe you can just say these out loud to them... make sure their reading focuses on the parts you want them to read."
- **Self-serve:** current fuller instruction screens, but rewritten to the register rules in 7.8 and cut by roughly a third.

### 5.2 Things the instructions must state explicitly (each caused a pilot question)

- The entire interaction is text chat. Coach tips, if any, arrive as messages, not audio.
- Whether the participant should treat outside lookups (dictionaries, search) as allowed. Default for the study: not allowed; asking the clinician *is the exercise*.
- How the session ends (see 6.4): the visit wraps up in conversation, then the participant clicks one button to move to their report card. No automatic transfer.

---

## 6. Stage 3 — Role-play engine

### 6.1 Hard constraints

- **12 turns maximum, or 10 minutes, whichever comes first.**
- **The clinician sends the opening turn.** The participant never faces an empty box.
- **One assigned scenario per participant, matched to `assigned_component`. No scenario selection menu.** The pilot exposed a menu (F8); remove it. Free choice decouples the challenge behavior from the screener and breaks the assignment logic. (If advisors later want participant agency here, the sanctioned mechanism is `preferred_focus`, not scenario choice.)

### 6.2 Opening turn design

The clinician begins in a defined non-neutral state and sends the first message. The opening turn should greet and orient in one sentence, reference something from `clinician_knows` so the visit feels continuous with the survey, leave an obvious gap that invites the participant to Present, and not ask an open question so broad that any answer counts.

**CONFIRM** — opening-turn behavior remains flagged as an open advisor item. The above is a starting proposal.

### 6.3 Mid-session behavior

- Challenge behaviors run per 4.5, with sticky yields.
- The clinician never gives real medical advice about the participant's actual condition (refusal principle in every persona).
- The clinician never references facts outside `clinician_knows` plus the conversation so far (4.3 rule 2).

### 6.4 Termination — soft close, visible pressure (pilot F7)

The v1 design cut the session at the cap with a closing message. The pilot showed this reads as abrupt and leaves the participant unsure what to do. The participant's own account of real visits is the design brief: the provider signals wrap-up and creates rush, the patient can push back and hold the door, but the pressure is felt throughout. Implement:

1. **Salient timer.** Countdown visible throughout; at 2 minutes remaining it changes state (color shift to a warning treatment, subtle pulse). The rush should be *felt in the interface*, matching the E-component training goal. Do not make it anxiogenic before the 2-minute mark.
2. **Wrap-up phase.** When 2 minutes or 3 turns remain (whichever first), the planner's available moves include `begin_wrapup`: the clinician starts steering to a close ("I want to be mindful of our time — let's make sure we've covered what you came in for"). This is itself an E/A opportunity: the participant can accept the close or hold the door with a remaining question.
3. **Grace behavior.** If the participant asks a substantive question during wrap-up, the clinician answers it (briefly, in character, possibly with visible impatience if `time_pressure` is active) rather than refusing. Hard refusal to engage teaches helplessness; answered-but-rushed matches reality and rewards speaking up.
4. **Close.** After the grace exchange (max 2 extra turns past the cap), the clinician sends a clear in-fiction goodbye, the input disables, and a single button appears: "See how you did." No automatic navigation.
5. **`resolution_state`** ∈ `resolved_early | resolved_at_cap | unresolved`, set by whether the yield condition was met and whether the participant's `must_ask_question` was asked. A participant who does everything right at turn 4 gets a visibly different ending (warm early close by the clinician) than one who never engages the target behavior. The report card reads differently for each state.

### 6.5 Safety

- `content_exclusions` filtered into the persona prompt as a hard constraint
- Persistent, visible framing that this is a practice simulation, not care
- A visible exit control on every screen, no confirmation friction
- Log nothing that is not needed (Section 10)

---

## 7. Stage 4 — Report card

This section absorbed most of the pilot damage. Rules 7.2, 7.5, and 7.6 existed in v1 and were violated by the deployed build; they are restated here with enforcement requirements. 7.7 and 7.8 are new.

### 7.1 Structure

Three levels, organized by PACE component.

```
Level 1  Session overview        one short paragraph, conditioned on resolution_state,
                                 assigned_component, and feedback_intensity (7.7)
Level 2  Component detail        for each of P, A, C, E: what happened, or "no chance
                                 to practice this one today"
Level 3  Turn-level examples     specific moments, with alternatives; capped per 7.6
```

### 7.2 The feedback taxonomy (Chaszczewicz et al., ACL 2024, adapted to PACE)

Co-designed with senior psychotherapy supervisors and validated against how supervisors deliver post-session feedback: positive reinforcement first, then a per-utterance pass; for each utterance needing work, clarify the goal at that point, name the skill categories, suggest an alternative. Delivery matters as much as content.

Five parts, applied per participant utterance:

1. **Appropriateness** — binary. **If appropriate, no further feedback is generated for that utterance. This is a gate, not a suggestion.** Optionally tag `good_areas`. (The pilot build critiqued appropriate utterances — F1. Write a unit test: an utterance annotated `appropriate: true` must produce no Level 3 item.)
2. **Goal and Alignment** — begins with the literal phrase "The goal is to". Explanation feedback outperforms correct-answer feedback for transfer (Butler et al. 2013); the goal text precedes and guides the alternative.
3. **Areas for Improvement** — selected only from the mistake lists in 7.4.
4. **Alternative Goal-Aligned Response** — a concrete rewrite in the participant's plausible voice, which must achieve the stated goal.
5. **Positive Reinforcement** (optional) — categories the participant excelled at, even on utterances that also need improvement.

Per-utterance annotation object:

```json
{
  "utterance": "participant's message text",
  "appropriate": false,
  "good_areas": ["P"],
  "linked_opportunity": "opp_2",
  "feedback": "The goal is to make sure the plan is actually understood before the visit ends. It might help to restate the two instructions in your own words rather than saying okay.",
  "bad_areas": ["C"],
  "alternative": "So just to check I have this right, I take it twice a day with food, and I come back in two weeks even if I feel fine?"
}
```

`linked_opportunity` is new and required for any `appropriate: false` annotation — see 7.5.

Length calibration from the source dataset: alternatives average ~28 tokens, goal text ~37 tokens; in their base rates 57.7 percent of utterances were appropriate. Enforce brevity in the prompt and clamp in code. Long feedback is a defect, not thoroughness.

### 7.3 Annotation prompt skeleton

1. Role framing — you give feedback to a patient practicing for a medical visit; roles are patient (trainee) and clinician (simulated).
2. Two options per utterance: appropriate (tag `good_areas`, stop), or could improve (produce goal, areas, alternative).
3. Goal text starts "The goal is to"; improvement phrased tentatively and in third person ("it might be better to", "it could help to"); never "the patient did X"; vary stock phrases within one annotation set; short dialogue fragments may be quoted.
4. Areas selected only from the 7.4 mistake lists, pasted in full.
5. Alternative must achieve the stated goal in the participant's plausible voice, not an idealized clinical register.
6. **Context rule.** Judge each utterance against the full prior conversation **plus** the survey-derived facts (`visit_goal`, `must_ask_question`, `worry_level`, `current_treatments`) **plus both continuity lists from 4.3.** An unasked `must_ask_question` is detectable only because the survey captured it; a "didn't present X" critique is *blocked* if X was in `clinician_knows`.
7. Tone rule — professional and friendly, focused on what is most beneficial for the trainee to hear; register per 7.8.
8. Output JSON only, matching 7.2.

A PACE session has at most ~6 participant turns, so a single annotation call is fine; write the annotator to accept an utterance range so chunking is trivial to add later.

### 7.4 Per-component mistake lists — the detection backbone

Category labels alone are too abstract for reliable detection; the mistake lists are what the model matches against. Seed lists below, drafted from the AHA PACE content, LEAPS items, and the Getting Ready form. **Drafts. The researcher must review with her advisor, mirroring the expert co-design step in the source work. One editable file, referenced by both the annotation prompt and the renderer.**

**P — Present**
- Burying the main concern mid-message or saving it for the end of the visit
- Describing a symptom without onset, duration, or severity
- Omitting what they have already tried and whether it helped — *only when treatment history is in `clinician_does_not_know`*
- Not stating what they hope the visit can accomplish
- Letting a clinician misunderstanding stand uncorrected
- Answering only the literal question asked when relevant context exists that the clinician has no way to know

**A — Ask**
- Ending the visit with the survey's must-ask question still unasked
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
- Not voicing a stated worry from the survey (`worry_level`, `suspected_cause`) when the relevant topic comes up
- Agreeing to a plan while holding unspoken doubts about feasibility (cost, side effects, schedule, ability to follow through)
- Downplaying or retracting a concern after a dismissive clinician response
- Not saying so when the clinician's explanation did not address the actual concern
- Ending the visit with the emotional stakes never named

### 7.5 Opportunity anchoring (new hard rule; pilot F1)

**A critique (any `appropriate: false` annotation that survives to the report card) must link to a planted embedded opportunity or to one of two survey-anchored global checks: the unasked `must_ask_question`, and an unvoiced `worry_level ≥ 3` worry.** Free-floating critique — the annotator deciding on its own that something "could be strengthened" — is where "comments for the sake of giving comments" comes from, and it is banned. Enforcement: the aggregator drops any negative annotation whose `linked_opportunity` is null and which matches neither global check, and logs the drop so the researcher can inspect what the annotator wanted to say.

Positive observations are exempt: the coach may praise anything.

This is deliberately stricter than the source taxonomy, and it trades recall for precision. That is the right trade here: the source work's own optimization target was worst-case feedback quality, on the argument that in a high-stakes training context one piece of bad feedback costs more than one missing piece.

### 7.6 Aggregation and volume cap — enforced in code, tested

```
annotations
  -> join with embedded_opportunities (was each opportunity met?)
  -> drop unanchored negatives (7.5)
  -> group surviving negatives by component (bad_areas)
  -> select ONE representative per component
     priority: linked to an embedded opportunity > earliest occurrence
  -> Level 3 = up to four goal / gap / alternative items (one per component, hard ceiling)
  -> Level 2 = per component: opportunities planted, opportunities met, strengths first,
               one-line status; if zero opportunities were planted for a component,
               emit the fixed string pattern "You didn't get a chance to practice ___
               this time" and nothing else for that component
  -> Level 1 = short overview conditioned on resolution_state, assigned_component,
               feedback_intensity
```

Rules restated because the pilot build violated them:

- Maximum **one** Level 3 item per component, four total, ceiling enforced in the aggregator, not requested in the prompt.
- Every component with any positive evidence gets its strength named first, before any gap.
- No invented critique for components without opportunities.
- Never render an all-negative card. If the participant met nothing, lead with effort and specificity of engagement and give a single highest-leverage item.

**QA substitution check.** For each Level 3 item, substitute the generated alternative into the transcript and re-run the annotator on it. If the substitute would not be marked appropriate, regenerate once; if it fails again, drop the item. This catches the known worst-case failure signature: alternatives that cosmetically rephrase without resolving the issue.

**Tests.** Build the annotator and aggregator against hand-written synthetic transcripts with known planted mistakes, including at minimum: (a) a flawless transcript (expected: recognition-only card, zero Level 3 items), (b) a transcript where a component had no opportunities (expected: the fixed no-chance string), (c) a transcript with an appropriate utterance the annotator is baited to critique (expected: no item). These three are the pilot failures as regression tests.

### 7.7 Screener-calibrated feedback intensity (new; pilot F4)

The pilot participant's assessment was exact: the coach "leans toward the patient who doesn't know what to do," which made it feel repetitive to a high-skill user, while "if you're targeting someone who really needs to practice, it's definitely helpful." The calibration signal already exists — the screener.

```
feedback_intensity = "light"    if screener_total <= LIGHT_MAX   (default 4)
                     "standard" otherwise
```

Thresholds in config, not code; the researcher will tune with her advisor.

- **standard** — the full pipeline as specified above.
- **light** — recognition-forward. Level 2 leads with observed strengths and *what happened* (an observation register: "you asked about both medications, and the doctor switched to plain language after you asked"), Level 3 carries at most **one** item total across all components (the single highest-leverage one), and the Level 1 overview frames the session as a successful rehearsal rather than a lesson. Rationale: for skilled users, observational feedback informs without judging (the lesson from performance-visualization systems like SimPatient), while decontextualized or unearned critique erodes trust — and self-efficacy, not error count, is the primary outcome for this population (Section 2).

Store `feedback_intensity` in `SessionState`; the researcher will analyze it as a design variable.

### 7.8 Participant-facing register (new hard requirement; pilot F3)

All coach and report-card text is read by patients, including adolescents. Rules, applied to prompt stock phrases and renderer templates alike:

- Target roughly an 8th-grade reading level.
- **Banned terms** in participant-facing output (maintain as a list in the same editable file as 7.4): "build-on moment", "utterance", "component" (say "skill"), "alignment", "reinforcement", clinical-supervision vocabulary generally. The pilot participant, herself a researcher, could not parse "one build-on moment"; the study population has no chance.
- Preferred plain equivalents: "one place you could have pushed a little more", "a moment you might handle differently next time", "something you did really well".
- The four skills are always named with a gloss on first use per card: "Present (telling your story)", "Ask (getting your questions answered)", "Check (making sure you understood)", "Express (saying what's worrying you)".
- Pilot the rendered card text itself with a non-researcher before the formative study. The card is a user interface, not a log.

### 7.9 Timing and export

- Corrective feedback is ex-post only (see Section 8 for the live-tip exception).
- The card is exportable (download/print). The pilot participant used and liked this; keep it.
- Build the report-card generator so it can be re-pointed at a partial transcript. The summary-vs-per-utterance feedback contrast is an untested question in the literature and a potential future study.

### 7.10 If sessions ever repeat

The one direct A/B result on summary feedback design (Tanaka et al., automated social skills training): feedback comparing the user to their own previous session was rated significantly higher than feedback without it — more than the format itself. Self-comparison is also the most demoralization-proof reference point there is. If PACE becomes multi-session, this is the highest-value addition. Out of scope for v1; do not build speculative support beyond keeping per-session annotations queryable by participant.

---

## 8. In-session coaching — resolved policy (pilot F11)

v1 specified no in-session coaching; the deployed pilot build had live tips anyway. The tension is now resolved as follows, and this section is the single source of truth:

**Live tips are reinforcement-only.** During the role-play, the coach may send at most **two** short messages per session, and only of the form "that was a real [skill move]" — e.g., "Nice — that was a real ask." Triggered only when an embedded opportunity is detected as met (which requires the cheap live classifier; if live detection is not built yet, ship zero live tips rather than approximating). Never corrective, never suggestive, never "you could also...". Visually distinct from the clinician (separate sender, muted style) so the fiction and the coaching channel cannot be confused.

Rationale: post-practice feedback preserves learner agency, and just-in-time corrective systems distract and foster overreliance, sometimes with negative effects when withdrawn — that argument stands and keeps correction ex-post. But the pilot's one well-received live tip was pure reinforcement, which carries no answer to copy and no mid-task cognitive load, and matches how the expert supervisors behind the feedback taxonomy behave: reinforce in the moment, correct in debrief. Reinforcement-only live tips behind a flag (`live_tips: on | off`, default **on** for the formative study) also sets up the summary-vs-live comparison as a future experiment.

**CONFIRM** — the researcher should confirm this policy with her advisor before the formative study; if there is doubt, ship with `live_tips: off`.

---

## 9. Open decisions — ask, do not guess

1. Backend model path: Anthropic API vs Vertex AI (BAA-covered `Dev-Cancer-Med-Health-Chatbot`), or both (Section 10)
2. Whether the five existing HTML-prototype doctor personas are ported, replaced, or used as seeds (4.5)
3. Mapping from the Prolific/ITHS challenge-cluster taxonomy onto P/A/C/E (3.4)
4. Opening-turn behavior (6.2) — open advisor item
5. Pre-visit survey administered in-app or externally (Qualtrics) with import
6. `LIGHT_MAX` threshold for feedback intensity (7.7) — advisor input
7. Live-tips default on or off for the formative study (Section 8)
8. Session count, single or repeated, which determines whether 7.10 is in scope

Resolved since v1 (do not re-open without the researcher): scenario assignment not selection (6.1); soft-close termination (6.4); ex-post corrective feedback with reinforcement-only live tips (Section 8); report card exportable (7.9); `current_treatments` survey item (3.3).

---

## 10. Data handling, compliance, and repository hygiene

These are firm.

- **No participant data in the public GitHub repo.** Not in fixtures, tests, example JSON, or commit history. Pre-commit check required.
- Synthetic personas and transcripts for all fixtures and demos.
- API keys never reach the client; all model calls go through the serverless proxy.
- **CONFIRM the model backend before writing the client.** Two paths: public Anthropic API via serverless proxy, and Seattle Children's Vertex AI on GCP inside the BAA-covered project. Different auth, data residency, and allowable content. One `LLMClient` interface, two adapters, nothing hardcoded.
- Transcripts are research data. Store separately from application state, with an explicit retention decision recorded in the repo.
- Structured logging of `SessionState` transitions, including the new fields: `screener_total`, `feedback_intensity`, dropped-annotation log (7.5), yield events with turn numbers, `resolution_state`, live tips sent.

Updated `SessionState`:

```
SessionState {
  session_id
  session_mode            // facilitated | self_serve
  survey_responses        // includes current_treatments
  screener_scores         // per-component vector + screener_total
  preferred_focus
  assigned_component      // P | A | C | E, from 3.4 scoring
  feedback_intensity      // light | standard, from 7.7
  scenario                // includes clinician_knows / clinician_does_not_know
  persona                 // includes yield_conditions
  embedded_opportunities
  transcript
  yield_events            // [{behavior, turn, met_by}]
  live_tips_sent          // [{turn, opportunity_id}]
  turn_annotations        // includes linked_opportunity
  dropped_annotations     // negatives removed by 7.5, kept for researcher inspection
  resolution_state        // resolved_early | resolved_at_cap | unresolved
  report_card
}
```

---

## 11. Build order

Each step independently demonstrable. Steps 1–2 include the audit fixes from the pilot.

1. **Audit and skeleton.** Verify (or fix) that `assigned_component` is screener-driven per 3.4 and that no scenario menu is exposed (6.1). `SessionState` with new fields, routing, four stage shells, `LLMClient` interface with mock adapter. No model calls.
2. **Survey.** All items from Section 3 including `current_treatments` and format rules 3.6. Scoring, `screener_total`, `feedback_intensity`. Fully testable with no LLM.
3. **Scenario and persona generation with the continuity contract.** Two-step prompt architecture, prompts in separate files, exhaustive `clinician_knows` partition, "What's in your chart" box, yield conditions attached to challenge behaviors. Verify by hand against five synthetic survey inputs, checking specifically that no P opportunity is planted for charted facts.
4. **Role-play, single turn.** Opening turn, one exchange, turn counter. Get sticky yield behavior right here before anything else — it is the hardest part of the build (4.7).
5. **Termination.** Timer states, wrap-up phase, grace behavior, close button, `resolution_state`.
6. **Embedded opportunity detection.** Batch pass at session end.
7. **Report card.** In pipeline order: annotator (7.2–7.3) with mistake lists (7.4) in a standalone editable file; aggregation with opportunity anchoring and volume cap enforced in code (7.5–7.6); substitution QA check; renderer with register rules (7.8) and intensity conditioning (7.7). Run the three pilot-derived regression tests in 7.6 before wiring to live sessions.
8. **Live tips** behind the flag (Section 8), including the cheap live opportunity classifier. Ship off if detection precision is poor.
9. **Onboarding modes and facilitator script** (Section 5).
10. **Safety and logging pass.** Exclusions, refusal principles, exit control, retention, dropped-annotation log.
11. **Adherence-check pipeline** behind a flag (4.6 step 3). Measure before enabling.

---

## 12. Reference list

**PACE lineage**
- Cegala, McClure, Marinelli, Post (2000). The effects of communication skills training on patients' participation during medical interviews. Patient Educ Couns 41, 209-222.
- Cegala et al. (2000). The effects of patient communication skills training on compliance. Arch Fam Med 9(1), 57-64.
- PACE Guide Sheet, OSU Wexner. https://wexnermedical.osu.edu/-/media/files/wexnermedical/blog/2017pace.pdf
- AHA PACE training content. https://www.heart.org/en/health-topics/cardiac-rehab/communicating-with-professionals/preparing-for-medical-visits
- Getting Ready form. https://gettingready.ca/media/site/e639127028-1756326050/getting_ready_form_250513.pdf
- D'Agostino et al. (2017). Promoting patient participation through communication skills training, a systematic review. PMC5466484.
- Roter et al. (2024). Online communication skill training of patients with cancer. PMC11169459. LEAPS items, Table 3.

**Patient-side visit-preparation coaching (pre-LLM; grounds the self-efficacy framing in Section 2)**
- Belkora et al. (2008). Training community resource center and clinic personnel to prompt patients in listing questions for doctors. PMC2270865. Consultation Planning.
- Belkora et al. (2017). The Effects of Coaching Patients to List Questions Before Visiting Cancer Specialists. J Participat Med. doi:10.2196/jopm.8949. Question-listing raised decision self-efficacy and lowered anxiety.

**LLM role-play and feedback**
- Shaikh, Chai, Gelfand, Yang, Bernstein (2024). Rehearsal: Simulating Conflict to Teach Conflict Resolution. CHI '24. https://arxiv.org/abs/2309.12309 — IRP prompting, agreeable-vs-stubborn ablation (4.7)
- Louie, Nandi, Fang, Chang, Brunskill, Yang (2024). Roleplay-doh. https://arxiv.org/abs/2407.00870 — principle elicitation, adherence pipeline
- Louie, Shah, Hasan Orney, Pacheco, Brunskill, Yang (2026). Can LLM-Simulated Practice and Feedback Upskill Human Counselors? CHI '26. https://arxiv.org/abs/2505.02428 — randomized study (n=94); structured feedback prevented empathy decline; practice-alone harm; demoralization finding behind 7.6; ex-post rationale behind Section 8
- Chaszczewicz, Shah, Louie, Arnow, Kraut, Yang (2024). Multi-Level Feedback Generation with LLMs for Empowering Novice Peer Counselors. ACL 2024. The feedback taxonomy behind 7.2–7.6. Code: https://github.com/SALT-NLP/counseling-feedback. Their Appendix I annotation prompt structures 7.3; their Table 4 mistake-list pattern structures 7.4.
- Steenstra, Nouraei, Bickmore (2025). Scaffolding Empathy: Training Counselors with Simulated Patients and Utterance-level Performance Visualizations (SimPatient). CHI '25. https://arxiv.org/abs/2502.18673 — utterance-level behavior coding and observation-style visualization; informs the "light" intensity mode (7.7)
- Lin, Sharma, Rytting, Miner, Suh, Althoff (2024). IMBUE. ACL 2024. https://aclanthology.org/2024.acl-long.47/ — skill mastery was the only outcome that transferred
- Wang et al. (2024). PATIENT-Ψ. https://arxiv.org/abs/2405.19660 — compare-with-reference feedback style, mental-health VP simulation
- Yang, Ziems, Held, Shaikh, Bernstein, Mitchell (2024). Social Skill Training with Large Language Models. https://arxiv.org/abs/2404.04204 — AI Partner plus AI Mentor framing
- EQClinic (Liu et al.) and ConverSense (as reviewed in CARE) — pre-LLM signal-visualization systems whose feedback was decontextualized and hard to apply; the cautionary case for keeping goal-anchored, transcript-specific feedback

**Feedback theory, for the writeup**
- Hattie and Timperley (2007). The Power of Feedback. Feed-up/feed-back/feed-forward; the structure behind goal-gap-alternative.
- Kluger and DeNisi (1996). Feedback intervention theory. Task-level, not person-level; why the card is organized by skill.
- Butler et al. (2013). Explanation feedback outperforms correct-answer feedback for transfer; why goal text precedes the alternative.
- Tannenbaum and Cerasoli (2013). Do team and individual debriefs enhance performance? Human Factors.
- Tanaka et al. Automated social skills training; self-comparison feedback finding (7.10).

---

## Appendix A — Changelog v1 → v2, by section

| v1 | v2 | Change |
|---|---|---|
| 3.3 | 3.3 | Added `current_treatments` (F5) |
| 3.4 | 3.4 | Same rule; added audit note (F8) and `screener_total` |
| — | 3.6 | New: structured-options preference, memory-cue prompts (F10) |
| 4.2 | 4.2–4.3 | Continuity split upgraded to a four-rule contract with chart box UI (F2, F5) |
| 4.4 | 4.4 | Opportunities constrained by continuity contract; zero-opportunity components legitimized |
| 4.3 | 4.5 | Yield conditions made per-behavior, sticky, and mandatory (F6); jargon density capped |
| 4.5 | 4.6 | Planner gains `begin_wrapup`; adherence check gains chart-fact question |
| — | 5 | New: facilitated/self-serve onboarding, facilitator script, explicit end-of-session explanation (F9) |
| 5.1 | 6.1 | Scenario menu explicitly banned (F8) |
| 5.3 | 6.4 | Hard cut replaced by salient timer, wrap-up phase, grace behavior, close button (F7) |
| 6.2 | 7.2 | Appropriateness gate restated as tested invariant (F1) |
| — | 7.5 | New: opportunity anchoring for all critique (F1, F2) |
| 6.5, 6.7 | 7.6 | Aggregation absorbs anchoring; caps enforced in code; three pilot regression tests |
| — | 7.7 | New: screener-calibrated intensity, light mode (F4) |
| — | 7.8 | New: plain-language register, banned-terms list (F3) |
| 6.8 | 7.9, 8 | Ex-post rule kept for correction; reinforcement-only live tips added, flagged (F11) |
| 8 | 9 | Open decisions updated; five items marked resolved |
