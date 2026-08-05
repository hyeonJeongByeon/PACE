// Report-card aggregation — HANDOVER_SPEC_V2.md §7.5–§7.7.
// PURE FUNCTIONS, no DOM, no LLM: this is where the hard rules live so they
// can be unit-tested (tests/aggregator.test.mjs runs the three pilot
// regression cases). app.js consumes these.

(function (root) {

  // §7.5 opportunity anchoring. Returns {kept, dropped}.
  // A negative annotation survives only if:
  //  - appropriate === false (the §7.2 gate: appropriate ⇒ never a critique), AND
  //  - linked_opportunity names a real planted opportunity, OR
  //  - linked_opportunity === "global_must_ask" AND the must-ask went unasked, OR
  //  - linked_opportunity === "global_worry" AND worry ≥ 3 AND it went unvoiced.
  function anchorFilter(annotations, opportunities, globalChecks, worryLevel) {
    const oppIds = new Set(opportunities.map(o => o.id));
    const kept = [], dropped = [];
    for (const a of annotations || []) {
      if (a.appropriate !== false) continue; // gate: appropriate ⇒ no critique, ever
      const link = a.linked_opportunity;
      const anchored =
        (link && oppIds.has(link)) ||
        (link === 'global_must_ask' && globalChecks && globalChecks.must_ask_question_asked === false) ||
        (link === 'global_worry' && globalChecks && globalChecks.worry_voiced === false && worryLevel >= 3);
      if (anchored && a.feedback && a.alternative) kept.push(a);
      else dropped.push({ reason: anchored ? 'incomplete_annotation' : 'unanchored', annotation: a });
    }
    return { kept, dropped };
  }

  // §7.6 Level 3 selection: ≤1 per component; total capped (4 standard, 1 light).
  // Priority: linked to a planted opportunity > earliest occurrence.
  function pickLevel3(keptNegatives, opportunities, intensity, caps) {
    const oppIds = new Set(opportunities.map(o => o.id));
    const cap = intensity === 'light' ? caps.light : caps.standard;
    const items = [];
    for (const comp of ['P', 'A', 'C', 'E']) {
      if (items.length >= cap) break;
      const candidates = keptNegatives
        .filter(a => Array.isArray(a.bad_areas) && a.bad_areas.includes(comp))
        .sort((a, b) => {
          const la = oppIds.has(a.linked_opportunity) ? 0 : 1;
          const lb = oppIds.has(b.linked_opportunity) ? 0 : 1;
          return la - lb || (a.turn || 0) - (b.turn || 0);
        });
      if (!candidates.length) continue;
      const c = candidates[0];
      if (items.some(i => i.turn === c.turn)) continue; // one item per moment
      items.push({ component: comp, turn: c.turn, utterance: c.utterance, feedback: c.feedback, alternative: c.alternative, linked_opportunity: c.linked_opportunity });
    }
    return items.slice(0, cap);
  }

  // §7.6 Level 2: strengths first; fixed no-chance string when a component had
  // zero planted opportunities (never invented critique).
  function buildLevel2(component, meta, opportunities, annotations) {
    const opps = opportunities.filter(o => o.component === component);
    const goodCount = (annotations || []).filter(a => (a.good_areas || []).includes(component)).length;
    const met = opps.filter(o => o.status === 'met').length;
    const partial = opps.filter(o => o.status === 'partial').length;
    const missed = opps.filter(o => o.status === 'missed').length;

    let statusLine;
    if (opps.length === 0) {
      // §7.6 fixed string pattern — and nothing else for this component.
      statusLine = `You didn't get a chance to practice ${meta.plain} this time.`;
    } else {
      const parts = [];
      if (goodCount) parts.push(`you did this well in ${goodCount} message${goodCount > 1 ? 's' : ''}`); // strengths first
      if (met) parts.push(`${met} built-in moment${met > 1 ? 's' : ''} handled`);
      if (partial) parts.push(`${partial} partly handled`);
      if (missed) parts.push(`${missed} slipped by`);
      statusLine = (parts.join(', ') || 'no clear moments this time') + '.';
      statusLine = statusLine.charAt(0).toUpperCase() + statusLine.slice(1);
    }
    return {
      component, gloss: meta.gloss, plain: meta.plain,
      opportunities: opps.map(o => ({ id: o.id, status: o.status })),
      noChance: opps.length === 0, goodCount, statusLine,
    };
  }

  // §7.6 never render an all-negative card.
  function hasAnyPositive(level2, level3, annotations) {
    return level2.some(l => l.goodCount > 0) ||
           (annotations || []).some(a => a.appropriate === true) ||
           level3.length === 0;
  }

  root.PACE_AGG = { anchorFilter, pickLevel3, buildLevel2, hasAnyPositive };
})(typeof window !== 'undefined' ? window : globalThis);
