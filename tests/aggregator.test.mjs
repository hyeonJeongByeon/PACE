// §7.6 regression tests — the three pilot failures, as required by the spec:
// (a) flawless transcript → recognition-only card, zero Level 3 items
// (b) component with no opportunities → the fixed no-chance string
// (c) appropriate utterance the annotator is baited to critique → no item
// Run: node tests/aggregator.test.mjs
// All fixtures are SYNTHETIC (repo rule: no participant data).

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
// aggregator.js attaches to globalThis when window is absent
eval(readFileSync(join(here, '../test2/js/aggregator.js'), 'utf8'));
const AGG = globalThis.PACE_AGG;

const META = {
  P: { gloss: 'Present (telling your story)', plain: 'telling your story' },
  A: { gloss: 'Ask (getting your questions answered)', plain: 'getting your questions answered' },
  C: { gloss: 'Check (making sure you understood)', plain: 'making sure you understood' },
  E: { gloss: 'Express (saying what\'s worrying you)', plain: 'saying what\'s worrying you' },
};
const CAPS = { standard: 4, light: 1 };

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// ── (a) flawless transcript: all annotations appropriate ──────────────────
{
  const opps = [
    { id: 'opp_1', component: 'P', status: 'met' },
    { id: 'opp_2', component: 'C', status: 'met' },
  ];
  const anns = [
    { turn: 1, appropriate: true, good_areas: ['P'] },
    { turn: 2, appropriate: true, good_areas: ['C'] },
  ];
  const { kept, dropped } = AGG.anchorFilter(anns, opps, { must_ask_question_asked: true, worry_voiced: true }, 4);
  const l3 = AGG.pickLevel3(kept, opps, 'standard', CAPS);
  check('(a) flawless → zero Level 3 items', l3.length === 0, `got ${l3.length}`);
  check('(a) flawless → nothing dropped as critique', dropped.length === 0);
  const l2 = ['P', 'A', 'C', 'E'].map(c => AGG.buildLevel2(c, META[c], opps, anns));
  check('(a) recognition-only card is positive', AGG.hasAnyPositive(l2, l3, anns));
}

// ── (b) component with zero opportunities → fixed no-chance string ────────
{
  const opps = [{ id: 'opp_1', component: 'P', status: 'met' }]; // nothing for E
  const l2E = AGG.buildLevel2('E', META.E, opps, []);
  check('(b) no-chance string used', l2E.statusLine === "You didn't get a chance to practice saying what's worrying you this time.", l2E.statusLine);
  check('(b) marked noChance', l2E.noChance === true);
}

// ── (c) appropriate utterance baited with critique fields → no item ───────
{
  const opps = [{ id: 'opp_1', component: 'P', status: 'met' }];
  const anns = [
    // annotator marked it appropriate but ALSO emitted critique fields (the bait)
    { turn: 1, appropriate: true, good_areas: ['P'], linked_opportunity: 'opp_1', bad_areas: ['P'], feedback: 'The goal is to …', alternative: 'better message' },
  ];
  const { kept } = AGG.anchorFilter(anns, opps, { must_ask_question_asked: true, worry_voiced: true }, 4);
  const l3 = AGG.pickLevel3(kept, opps, 'standard', CAPS);
  check('(c) appropriate ⇒ gate holds, no Level 3 item', l3.length === 0, `got ${l3.length}`);
}

// ── §7.5 anchoring: unanchored negatives are dropped and logged ───────────
{
  const opps = [{ id: 'opp_1', component: 'C', status: 'missed' }];
  const anns = [
    { turn: 1, appropriate: false, linked_opportunity: null, bad_areas: ['P'], feedback: 'The goal is to …', alternative: 'x' },        // unanchored → drop
    { turn: 2, appropriate: false, linked_opportunity: 'opp_1', bad_areas: ['C'], feedback: 'The goal is to …', alternative: 'x' },     // anchored → keep
    { turn: 3, appropriate: false, linked_opportunity: 'global_must_ask', bad_areas: ['A'], feedback: 'The goal is to …', alternative: 'x' }, // valid global
    { turn: 4, appropriate: false, linked_opportunity: 'global_worry', bad_areas: ['E'], feedback: 'The goal is to …', alternative: 'x' },    // invalid: worry was voiced
  ];
  const { kept, dropped } = AGG.anchorFilter(anns, opps, { must_ask_question_asked: false, worry_voiced: true }, 4);
  check('§7.5 keeps anchored + valid global', kept.length === 2, `kept ${kept.length}`);
  check('§7.5 drops unanchored + invalid global, logged', dropped.length === 2 && dropped.every(d => d.reason === 'unanchored'));
}

// ── §7.7 light intensity: max ONE Level 3 item total ──────────────────────
{
  const opps = [
    { id: 'opp_1', component: 'P', status: 'missed' },
    { id: 'opp_2', component: 'C', status: 'missed' },
  ];
  const anns = [
    { turn: 1, appropriate: false, linked_opportunity: 'opp_1', bad_areas: ['P'], feedback: 'The goal is to …', alternative: 'x' },
    { turn: 2, appropriate: false, linked_opportunity: 'opp_2', bad_areas: ['C'], feedback: 'The goal is to …', alternative: 'x' },
  ];
  const { kept } = AGG.anchorFilter(anns, opps, { must_ask_question_asked: true, worry_voiced: true }, 2);
  check('§7.7 light cap = 1', AGG.pickLevel3(kept, opps, 'light', CAPS).length === 1);
  check('§7.6 standard keeps both (≤4)', AGG.pickLevel3(kept, opps, 'standard', CAPS).length === 2);
}

console.log(failures === 0 ? '\nAll aggregator tests passed.' : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
