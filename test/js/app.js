// PACE v2 engine. Stages per HANDOVER_SPEC.md §2:
// survey → instantiation → role-play (two-step plan/generate, clock-managed)
// → report card (annotate → aggregate → QA → render).
// Prompts live in js/prompts/*; content in survey.js / scenarios.js / mistakes.js.

(function () {
  const CFG = window.PACE_CONFIG;
  const PR = window.PACE_PROMPTS;
  const SURVEY = window.PACE_SURVEY;
  const SEEDS = window.PACE_SCENARIO_SEEDS;
  const MISTAKES = window.PACE_MISTAKES;
  const ST = window.PACE_STATE;

  let S = ST.newSession();
  let passcode = '';
  let busy = false;
  let timerInterval = null;
  let awaitingClosingAnswer = false;
  let openOpp = null;          // currently open embedded opportunity
  let reofferPending = false;  // coach just intervened; clinician re-offers

  // ── LLM client (single swappable path — HANDOVER §7 CONFIRM) ────────────
  async function callModel(prompt, maxTokens) {
    const r = await fetch(CFG.PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-study-passcode': passcode },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens || 600 }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || data?.error || `Proxy error ${r.status}`);
    const text = data?.content?.[0]?.text;
    if (!text) throw new Error('Empty model response');
    return text;
  }

  function tryJSON(raw) {
    if (!raw) return null;
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    try { return JSON.parse(m ? m[0] : cleaned); } catch { return null; }
  }

  async function callJSON(prompt, maxTokens, retries) {
    let lastErr;
    for (let i = 0; i <= (retries ?? 1); i++) {
      try {
        const j = tryJSON(await callModel(prompt, maxTokens));
        if (j) return j;
        lastErr = new Error('Unparseable model output');
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  // ── Views ───────────────────────────────────────────────────────────────
  function show(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('topbar').style.display = id === 'view-gate' ? 'none' : 'flex';
    window.scrollTo(0, 0);
  }

  function esc(t) { return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ── Gate ────────────────────────────────────────────────────────────────
  function enterPasscode() {
    const v = document.getElementById('passcode-input').value.trim();
    if (!v) { document.getElementById('gate-err').textContent = 'Passcode required.'; return; }
    passcode = v;
    sessionStorage.setItem('pace2_passcode', v);
    ST.logTransition(S, 'gate', 'education');
    show('view-education');
  }

  // ── Menu ────────────────────────────────────────────────────────────────
  function buildMenu() {
    const list = document.getElementById('seed-list');
    SEEDS.forEach(seed => {
      const el = document.createElement('div');
      el.className = 'card scenario-card';
      el.innerHTML = `<b style="font-size:.9rem">${esc(seed.title)}</b>
        <div style="font-size:.85rem;color:var(--ink-soft);margin-top:.25rem">${esc(seed.menuDescription)}</div>`;
      el.onclick = () => {
        document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('sel'));
        el.classList.add('sel');
        S.chosen_seed = seed.id;
        document.getElementById('menu-next').disabled = false;
      };
      list.appendChild(el);
    });
  }
  function toMenu() { ST.logTransition(S, S.stage, 'menu'); show('view-menu'); }

  // ── Survey ──────────────────────────────────────────────────────────────
  function buildSurvey() {
    const A = document.getElementById('survey-partA');
    SURVEY.partA.forEach(item => {
      const q = document.createElement('div');
      q.className = 'q';
      let control = '';
      if (item.type === 'text') control = `<textarea id="sv-${item.key}" placeholder="${esc(item.placeholder)}"></textarea>`;
      else if (item.type === 'select') control = `<select id="sv-${item.key}"><option value="">Choose…</option>${item.options.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
      else if (item.type === 'scale05') control = `<div class="scale05" id="sv-${item.key}">${[0,1,2,3,4,5].map(n => `<button type="button" data-v="${n}">${n}</button>`).join('')}<span class="mute" style="margin-left:.4rem">${esc(item.minLabel)} → ${esc(item.maxLabel)}</span></div>`;
      q.innerHTML = `<label class="qlabel">${esc(item.label)}${item.required ? '' : ''} <span class="src">${esc(item.source)}</span></label>${control}`;
      A.appendChild(q);
      if (item.type === 'scale05') {
        q.querySelectorAll('button').forEach(b => b.onclick = () => {
          q.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
          b.classList.add('sel');
        });
      }
    });

    const B = document.getElementById('survey-partB');
    SURVEY.screener.forEach(item => {
      const row = document.createElement('div');
      row.className = 'likert-row';
      row.id = `sv-${item.key}`;
      row.innerHTML = `<span>${esc(item.label)}</span>` +
        SURVEY.screenerScale.map(v => `<span class="opt"><input type="radio" name="${item.key}" value="${v}"></span>`).join('');
      B.appendChild(row);
    });

    const F = document.getElementById('survey-focus');
    const fWrap = document.createElement('div');
    fWrap.className = 'radio-list';
    fWrap.innerHTML = `<label class="qlabel" style="font-weight:600;font-size:.88rem">${esc(SURVEY.preferredFocus.label)}</label>` +
      SURVEY.preferredFocus.options.map(o => `<label><input type="radio" name="preferred_focus" value="${o.value}"> ${esc(o.label)}</label>`).join('');
    F.appendChild(fWrap);

    const X = document.getElementById('survey-safety');
    X.innerHTML = `<div class="q" style="margin-bottom:0"><label class="qlabel">${esc(SURVEY.contentExclusions.label)}</label><textarea id="sv-content_exclusions" placeholder="${esc(SURVEY.contentExclusions.placeholder)}"></textarea></div>`;
  }
  function toSurvey() { ST.logTransition(S, 'menu', 'survey'); show('view-survey'); }

  function collectSurvey() {
    const out = {};
    for (const item of SURVEY.partA) {
      if (item.type === 'scale05') {
        const sel = document.querySelector(`#sv-${item.key} button.sel`);
        out[item.key] = sel ? Number(sel.dataset.v) : null;
        if (item.required && out[item.key] === null) return { err: `Please answer: "${item.label}"` };
      } else {
        const v = document.getElementById(`sv-${item.key}`).value.trim();
        out[item.key] = v;
        if (item.required && !v) return { err: `Please answer: "${item.label}"` };
      }
    }
    for (const item of SURVEY.screener) {
      const v = document.querySelector(`input[name="${item.key}"]:checked`);
      if (!v) return { err: 'Please answer all of the "past visits" items.' };
      out[item.key] = v.value;
    }
    const pf = document.querySelector('input[name="preferred_focus"]:checked');
    if (!pf) return { err: 'Please choose which skill you\'d most like to get better at.' };
    out.preferred_focus = pf.value;
    out.content_exclusions = document.getElementById('sv-content_exclusions').value.trim();
    return { survey: out };
  }

  async function submitSurvey() {
    const { survey, err } = collectSurvey();
    if (err) { document.getElementById('survey-err').textContent = err; return; }
    S.survey_responses = survey;
    const { scores, assigned } = ST.assignComponent(survey);
    S.component_scores = scores;
    S.assigned_component = assigned;
    ST.logTransition(S, 'survey', 'instantiation', `assigned=${assigned} scores=${JSON.stringify(scores)} preferred=${survey.preferred_focus}`);
    show('view-generating');
    await instantiate();
  }

  // ── Stage 2: instantiation ──────────────────────────────────────────────
  async function instantiate() {
    const seed = SEEDS.find(s => s.id === S.chosen_seed) || SEEDS[0];
    try {
      const j = await callJSON(PR.instantiate(S.survey_responses, seed, S.assigned_component, CFG), 1800, 1);
      if (!j.scenario || !j.persona || !Array.isArray(j.embedded_opportunities) || j.embedded_opportunities.length < 2) {
        throw new Error('Incomplete scenario object');
      }
      S.scenario = j.scenario;
      S.persona = j.persona;
      S.embedded_opportunities = j.embedded_opportunities.slice(0, CFG.MAX_OPPORTUNITIES)
        .map(o => ({ ...o, status: 'not_surfaced', detected: false, detected_at_turn: null, nudged: false }));
    } catch (e) {
      console.error('Instantiation failed, using fallback:', e);
      buildFallbackScenario(seed);
    }
    ST.logTransition(S, 'instantiation', 'briefing', `opps=${S.embedded_opportunities.length}`);
    document.getElementById('brief-premise').textContent = S.scenario.premise;
    show('view-briefing');
  }

  // Deterministic fallback so a bad model response never bricks a session.
  function buildFallbackScenario(seed) {
    const sv = S.survey_responses;
    S.scenario = {
      scenario_id: 'fallback-' + seed.id,
      premise: `You are at a clinic visit about ${sv.problem_text} (going on for ${sv.problem_duration.toLowerCase()}). You hope the provider can ${sv.visit_goal}. You have one question you don't want to forget: "${sv.must_ask_question}". The clinician has your name on the schedule and a one-line note about the topic — the details are yours to bring.`,
      clinician_knows: [`Visit booked about: ${sv.problem_text}`],
      clinician_does_not_know: ['duration and severity', 'impact on daily life', 'what has been tried', 'the patient\'s worry and feared cause', 'the patient\'s must-ask question'],
      opening_turn: `Hi, come on in. I see we're talking about ${sv.problem_text} today — tell me where things stand.`,
      target_component: S.assigned_component,
    };
    S.persona = {
      persona_id: 'fallback-persona', display_name: 'Dr. Alvarez',
      description: seed.persona_seed,
      principles: [
        'Keep replies to 1–3 sentences of realistic visit dialogue.',
        'Do not volunteer information the patient has not asked about.',
        'Never give real medical advice; all clinical content stays within this fictional practice scenario.',
        'If the participant appears to share real personal medical details beyond the scenario, do not engage with them; steer back to the practice scenario.',
      ],
      challenge_behaviors: seed.challenge_behaviors,
      yield_condition: seed.yield_seed,
    };
    S.embedded_opportunities = [
      { id: 'opp_1', component: 'P', trigger: 'Ask a lazy, general opening question that invites detail without probing', expected_behavior: 'Participant presents onset, severity, and impact unprompted', status: 'not_surfaced', detected: false, detected_at_turn: null, nudged: false },
      { id: 'opp_2', component: S.assigned_component, trigger: 'Introduce a plan element briefly and without explanation', expected_behavior: `Participant uses the ${S.assigned_component} skill on the plan`, status: 'not_surfaced', detected: false, detected_at_turn: null, nudged: false },
      { id: 'opp_3', component: 'E', trigger: 'Move toward closing while their stated worry has not been addressed', expected_behavior: 'Participant voices the worry or the unasked question', status: 'not_surfaced', detected: false, detected_at_turn: null, nudged: false },
    ];
  }

  // ── Stage 3: role-play ──────────────────────────────────────────────────
  function startVisit() {
    ST.logTransition(S, 'briefing', 'roleplay');
    S.visit.started_at = new Date().toISOString();
    S._visitStartMs = Date.now();
    document.getElementById('rp-name').textContent = S.persona.display_name;
    document.getElementById('rp-sub').textContent = 'Practice visit';
    document.getElementById('situation-text').textContent = S.scenario.premise;
    document.getElementById('situation-strip').classList.remove('collapsed');
    show('view-roleplay');
    timerInterval = setInterval(tickTimer, 1000);

    pushMsg('clinician', S.scenario.opening_turn);
    setBusy(false);
  }

  function elapsedMin() { return (Date.now() - S._visitStartMs) / 60000; }

  function phaseFor(min) {
    const f = min / CFG.VISIT_MINUTES;
    if (f < CFG.PHASE_EXPLORE_UNTIL) return 'explore';
    if (f < CFG.PHASE_ADDRESS_UNTIL) return 'address';
    if (f < CFG.PHASE_WRAP_UNTIL) return 'wrap';
    return 'close';
  }

  function tickTimer() {
    const ms = Date.now() - S._visitStartMs;
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    const el = document.getElementById('rp-timer');
    if (el) el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    // Hard failsafe: if the participant walked away past the hard stop, close.
    if (elapsedMin() >= CFG.HARD_STOP_MINUTES && !busy && S.stage === 'roleplay') {
      forceClose();
    }
  }

  async function forceClose() {
    if (busy) return;
    setBusy(true);
    try {
      const g = await callJSON(PR.generator(S, { move: 'end_visit' }, transcriptFor('clinician'), null), 300, 1);
      pushMsg('clinician', g.message || 'We\'re out of time for today — take care, and we\'ll pick this up next visit.');
    } catch (e) {
      pushMsg('clinician', 'We\'re out of time for today — take care.');
    }
    endVisit('hard_stop');
  }

  function transcriptFor(audience) {
    // clinician-facing transcript excludes coach asides; annotator includes them.
    let pturn = 0;
    return S.transcript.map(m => {
      if (m.role === 'coach') return audience === 'annotator' ? `COACH (aside): ${m.text}` : null;
      if (m.role === 'participant') { return `Patient (turn ${m.turn}): ${m.text}`; }
      return `Clinician: ${m.text}`;
    }).filter(Boolean).join('\n');
  }

  function pushMsg(role, text, extra) {
    const entry = Object.assign({ ts: new Date().toISOString(), role, text }, extra || {});
    if (role === 'participant') { S.visit.participant_turns++; entry.turn = S.visit.participant_turns; }
    S.transcript.push(entry);
    renderMsg(entry);
  }

  function renderMsg(entry) {
    const log = document.getElementById('chat-log');
    const div = document.createElement('div');
    if (entry.role === 'coach') {
      div.className = 'coach-aside';
      div.innerHTML = `<div class="coach-tag">🎓 Coach</div>${esc(entry.text)}`;
    } else {
      div.className = `msg ${entry.role === 'participant' ? 'participant' : ''}`;
      const avatar = entry.role === 'participant' ? 'You' : '🩺';
      div.innerHTML = `<div class="m-avatar">${avatar}</div><div class="bubble">${esc(entry.text)}</div>`;
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function addError(msg) {
    const log = document.getElementById('chat-log');
    const div = document.createElement('div');
    div.className = 'err';
    div.textContent = '⚠ ' + msg;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  let typingEl = null;
  function showTyping(on) {
    const log = document.getElementById('chat-log');
    if (on && !typingEl) {
      typingEl = document.createElement('div');
      typingEl.className = 'msg';
      typingEl.innerHTML = `<div class="m-avatar">🩺</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
      log.appendChild(typingEl);
      log.scrollTop = log.scrollHeight;
    } else if (!on && typingEl) { typingEl.remove(); typingEl = null; }
  }

  function setBusy(v) {
    busy = v;
    const inp = document.getElementById('chat-input');
    const btn = document.getElementById('send-btn');
    const done = S.stage !== 'roleplay';
    inp.disabled = v || done;
    btn.disabled = inp.disabled;
    if (!inp.disabled) inp.focus();
  }

  function lastRole() {
    return S.transcript.length ? S.transcript[S.transcript.length - 1].role : null;
  }

  async function send() {
    if (busy || S.stage !== 'roleplay') return;
    const inp = document.getElementById('chat-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    setBusy(true);

    if (S.visit.participant_turns === 0) document.getElementById('situation-strip').classList.add('collapsed');
    pushMsg('participant', text, openOpp ? { opp_id: openOpp.id } : {});

    try {
      await clinicianTurn(text);
    } catch (e) {
      console.error(e);
      addError(e.message);
      setBusy(false);
    }
  }

  async function clinicianTurn(participantText) {
    showTyping(true);
    const min = elapsedMin();
    const phase = min >= CFG.HARD_STOP_MINUTES ? 'close' : phaseFor(min);
    const remaining = S.embedded_opportunities.filter(o => o.status === 'not_surfaced');

    // Step 1 — PLAN (also detects open-opportunity status + yield)
    const plan = await callJSON(
      PR.planner(S, CFG, min, phase, transcriptFor('clinician'), openOpp, remaining, reofferPending),
      350, 1
    );
    reofferPending = false;

    // Opportunity bookkeeping + in-session coach (budgeted, never stacking)
    let coached = false;
    if (openOpp && ['met', 'partial', 'missed'].includes(plan.open_opportunity_status)) {
      const st = plan.open_opportunity_status;
      const opp = openOpp;
      const lastClin = [...S.transcript].reverse().find(m => m.role === 'clinician');
      S.transcript[S.transcript.length - 1].opp_status = st;

      if (st === 'missed' && !opp.nudged && S.visit.nudges_used < CFG.COACH_NUDGE_BUDGET && lastRole() !== 'coach') {
        opp.nudged = true;
        S.visit.nudges_used++;
        coached = true;
        try {
          const c = await callJSON(PR.coach(opp, lastClin ? lastClin.text : '', participantText, MISTAKES), 220, 1);
          showTyping(false);
          pushMsg('coach', c.nudge || `This could be a moment to ${opp.expected_behavior}.`, { opp_id: opp.id });
        } catch (e) {
          showTyping(false);
          pushMsg('coach', `This could be a moment to ${opp.expected_behavior}.`, { opp_id: opp.id });
        }
        showTyping(true);
        // clinician re-offers the same moment; opportunity stays open
      } else {
        opp.status = st;
        opp.detected = st !== 'missed';
        opp.detected_at_turn = S.visit.participant_turns;
        if (st === 'met' && !opp.nudged && S.visit.praise_used < CFG.COACH_PRAISE_BUDGET && lastRole() !== 'coach') {
          S.visit.praise_used++;
          showTyping(false);
          pushMsg('coach', PR.praise(MISTAKES[opp.component].name), { opp_id: opp.id, praise: true });
          showTyping(true);
        }
        openOpp = null;
      }
    }

    // Yield tracking
    if (plan.yield_met && !S.visit.yield_met) {
      S.visit.yield_met = true;
      S.visit.yield_met_at_ms = Date.now() - S._visitStartMs;
    }

    // Step 2 — GENERATE
    let genPlan = plan;
    let oppToOpen = null;
    if (coached) {
      genPlan = { move: 'reoffer', reofferTrigger: openOpp.trigger };
    } else if (plan.opportunity_to_open && plan.opportunity_to_open !== 'null' && !['close', 'end_visit'].includes(plan.move)) {
      const o = S.embedded_opportunities.find(x => x.id === plan.opportunity_to_open && x.status === 'not_surfaced');
      if (o) {
        o.status = 'open';
        oppToOpen = o;
        openOpp = o;
      }
    }

    const g = await callJSON(PR.generator(S, genPlan, transcriptFor('clinician'), oppToOpen), 350, 1);
    showTyping(false);
    pushMsg('clinician', g.message || '…', oppToOpen ? { opp_id: oppToOpen.id, opened: true } : {});

    if (genPlan.move === 'close') awaitingClosingAnswer = true;
    if (genPlan.move === 'end_visit') return endVisit('planned_end');
    setBusy(false);
  }

  function endVisit(how) {
    clearInterval(timerInterval);
    S.visit.ended_at = new Date().toISOString();
    // Anything still open at the end was surfaced but never answered → missed.
    S.embedded_opportunities.forEach(o => { if (o.status === 'open') o.status = 'missed'; });
    const endedMin = (Date.now() - S._visitStartMs) / 60000;
    S.resolution_state = S.visit.yield_met
      ? (endedMin < CFG.VISIT_MINUTES * 0.8 ? 'resolved_early' : 'resolved_at_cap')
      : 'unresolved';
    ST.logTransition(S, 'roleplay', 'report', `how=${how} resolution=${S.resolution_state} turns=${S.visit.participant_turns}`);
    document.getElementById('summary-sub').textContent =
      `${S.persona.display_name} · ${S.visit.participant_turns} messages · ${Math.round(endedMin)} min`;
    show('view-summary');
    generateReport();
  }

  function exitNow() {
    // Visible exit, no confirmation friction (HANDOVER §5.4).
    if (S.stage === 'roleplay' && S.visit.participant_turns >= 1) {
      S.visit.exited_early = true;
      endVisit('participant_exit'); // report card re-pointed at partial transcript (§6.8)
    } else {
      clearInterval(timerInterval);
      ST.logTransition(S, S.stage, 'exited');
      show('view-exited');
    }
  }

  // ── Stage 4: report card ────────────────────────────────────────────────
  function progress(msg) {
    const el = document.getElementById('summary-progress');
    if (el) el.textContent = msg;
  }

  async function generateReport() {
    let ann = null;
    try {
      progress('Reviewing your conversation…');
      ann = await callJSON(PR.annotator(S, MISTAKES, transcriptFor('annotator'), null), 1900, 1);
    } catch (e) { console.error('Annotator failed:', e); }

    if (ann) {
      S.turn_annotations = ann.annotations || [];
      (ann.opportunity_review || []).forEach(r => {
        const o = S.embedded_opportunities.find(x => x.id === r.id);
        if (o && ['met', 'partial', 'missed', 'not_surfaced'].includes(r.status)) o.status = r.status;
      });
    } else {
      S.turn_annotations = [];
    }

    // §6.5 aggregation with §6.7 volume cap, enforced in code.
    progress('Putting your summary together…');
    const level3 = pickLevel3();
    await qaFilter(level3);

    const level2 = ['P', 'A', 'C', 'E'].map(k => buildLevel2(k));
    const componentSummaries = level2.map(l =>
      `${l.component}: opportunities ${l.oppText || 'none in this scenario'}; praised in ${l.goodCount} message(s)`).join(' | ');

    let level1 = null;
    try {
      progress('Writing your next-visit notes…');
      level1 = await callJSON(PR.overview(S, componentSummaries), 700, 1);
    } catch (e) { console.error('Overview failed:', e); }

    S.report_card = {
      level1: level1 || {
        overview: 'You completed a full practice visit — the transcript below your download captures what happened. (The automatic summary could not be generated this time.)',
        next_visit_prep: [`Bring your must-ask question written down: "${S.survey_responses.must_ask_question}"`],
        goal_line: 'Carry one PACE behavior into your next real visit.',
      },
      level2,
      level3,
      generated_at: new Date().toISOString(),
    };
    renderReport();
  }

  function annTurnLinkedToOpp(annotation, component) {
    return S.embedded_opportunities.some(o =>
      o.component === component && o.detected_at_turn === annotation.turn);
  }

  function pickLevel3() {
    // ≤1 item per component, ≤4 total. Priority: linked to an embedded
    // opportunity > earliest occurrence (§6.5).
    const items = [];
    for (const comp of ['P', 'A', 'C', 'E']) {
      const candidates = (S.turn_annotations || [])
        .filter(a => a.appropriate === false && Array.isArray(a.bad_areas) && a.bad_areas.includes(comp) && a.feedback && a.alternative);
      if (!candidates.length) continue;
      candidates.sort((a, b) => {
        const la = annTurnLinkedToOpp(a, comp) ? 0 : 1;
        const lb = annTurnLinkedToOpp(b, comp) ? 0 : 1;
        return la - lb || a.turn - b.turn;
      });
      const c = candidates[0];
      items.push({ component: comp, turn: c.turn, utterance: c.utterance, feedback: c.feedback, alternative: c.alternative, good_areas: c.good_areas || [] });
      if (items.length >= CFG.MAX_LEVEL3_ITEMS) break;
    }
    return items;
  }

  function substitutedTranscript(turn, alternative) {
    return S.transcript.map(m => {
      if (m.role === 'coach') return null;
      if (m.role === 'participant') return `Patient (turn ${m.turn}): ${m.turn === turn ? alternative : m.text}`;
      return `Clinician: ${m.text}`;
    }).filter(Boolean).join('\n');
  }

  async function qaFilter(items) {
    // §6.6 substitution check: regenerate once, drop on second failure.
    progress('Double-checking the suggestions…');
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      try {
        const full = S.transcript.find(m => m.role === 'participant' && m.turn === it.turn);
        const origText = full ? full.text : it.utterance;
        let check = await callJSON(PR.qaCheck(S, MISTAKES, substitutedTranscript(it.turn, it.alternative), it.turn, it.alternative, it.feedback), 200, 0);
        if (check.appropriate === true) continue;
        const regen = await callJSON(PR.qaRegen(transcriptFor('annotator'), it.turn, origText, it.feedback, check.why || 'did not achieve the goal'), 200, 0);
        if (regen.alternative) {
          check = await callJSON(PR.qaCheck(S, MISTAKES, substitutedTranscript(it.turn, regen.alternative), it.turn, regen.alternative, it.feedback), 200, 0);
          if (check.appropriate === true) { it.alternative = regen.alternative; it.regenerated = true; continue; }
        }
        items.splice(i, 1); // worst-case guard: drop rather than show bad feedback
      } catch (e) { /* on QA infrastructure failure keep the item */ }
    }
  }

  function buildLevel2(comp) {
    const opps = S.embedded_opportunities.filter(o => o.component === comp);
    const anns = S.turn_annotations || [];
    const goodCount = anns.filter(a => (a.good_areas || []).includes(comp)).length;
    const met = opps.filter(o => o.status === 'met').length;
    const partial = opps.filter(o => o.status === 'partial').length;
    const missed = opps.filter(o => o.status === 'missed').length;
    let status;
    if (!opps.length && !goodCount) status = `This visit didn't create a real ${MISTAKES[comp].name} moment — nothing to grade here.`;
    else {
      const parts = [];
      if (goodCount) parts.push(`you showed this skill in ${goodCount} message${goodCount > 1 ? 's' : ''}`);
      if (met) parts.push(`${met} built-in moment${met > 1 ? 's' : ''} met`);
      if (partial) parts.push(`${partial} partly met`);
      if (missed) parts.push(`${missed} slipped by`);
      status = parts.join(', ') + '.';
      status = status.charAt(0).toUpperCase() + status.slice(1);
    }
    return {
      component: comp, name: MISTAKES[comp].name, plain: MISTAKES[comp].plain,
      opportunities: opps.map(o => ({ id: o.id, status: o.status })),
      oppText: opps.length ? `${met} met / ${partial} partial / ${missed} missed of ${opps.length}` : null,
      goodCount, statusLine: status,
    };
  }

  const CHIP = { met: 'met', partial: 'partial', missed: 'missed', not_surfaced: 'none', open: 'none' };
  const CHIP_LABEL = { met: 'Tried it', partial: 'Partially', missed: 'Opportunity missed', not_surfaced: 'Not reached', open: 'Not reached' };

  function renderReport() {
    const rc = S.report_card;
    const body = document.getElementById('summary-body');
    let html = '';

    html += `<div class="level-tag">Overview</div>
      <div class="card" style="font-size:.92rem;line-height:1.65">${esc(rc.level1.overview)}</div>`;

    html += `<div class="level-tag">Skill by skill</div>`;
    for (const l of rc.level2) {
      const target = l.component === S.assigned_component ? ` <span class="chip" style="background:var(--accent-soft);color:var(--accent)">your focus</span>` : '';
      html += `<div class="card">
        <div class="comp-head"><div class="pace-letter ${l.component}" style="width:30px;height:30px;flex:0 0 30px;font-size:.85rem">${l.component}</div>
          <b>${esc(l.name)}${target}</b>
          ${l.opportunities.map(o => `<span class="chip ${CHIP[o.status] || 'none'}">${CHIP_LABEL[o.status] || o.status}</span>`).join(' ')}
        </div>
        <div class="report-row">${esc(l.statusLine)}</div>
      </div>`;
    }

    if (rc.level3.length) {
      html += `<div class="level-tag">Moments worth a second look</div>`;
      for (const it of rc.level3) {
        html += `<div class="card">
          <div class="comp-head"><div class="pace-letter ${it.component}" style="width:30px;height:30px;flex:0 0 30px;font-size:.85rem">${it.component}</div><b>${esc(MISTAKES[it.component].name)}</b><span class="mute">your message ${it.turn}</span></div>
          <div class="l3-quote">"${esc(it.utterance)}"</div>
          <div class="report-row">${esc(it.feedback)}</div>
          <div class="l3-alt">You could say: "${esc(it.alternative)}"</div>
        </div>`;
      }
    }

    html += `<div class="level-tag">For your next real visit</div>
      <div class="card"><ul style="padding-left:1.1rem;font-size:.88rem;line-height:1.7">${(rc.level1.next_visit_prep || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>
      <div class="goal-band"><div class="g-label">Your one goal</div>${esc(rc.level1.goal_line)}</div>`;

    body.innerHTML = html;
    document.getElementById('summary-tools').style.display = 'flex';
  }

  // ── Downloads (client-side only) ────────────────────────────────────────
  function dl(filename, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadJSON() {
    dl(`${S.session_id}.json`, JSON.stringify(S, null, 2), 'application/json');
  }

  function downloadReport() {
    const rc = S.report_card;
    const md = [
      `# PACE Practice Summary`,
      `${new Date().toLocaleDateString()} · ${S.persona.display_name} · practice visit (simulation — not medical advice)`,
      ``, `## Overview`, rc.level1.overview, ``,
      `## Skill by skill`,
      ...rc.level2.map(l => `- **${l.name} (${l.component})** — ${l.statusLine}${l.opportunities.length ? ' [' + l.opportunities.map(o => CHIP_LABEL[o.status] || o.status).join(', ') + ']' : ''}`),
      ``, `## Moments worth a second look`,
      ...(rc.level3.length ? rc.level3.flatMap(it => [
        `### ${MISTAKES[it.component].name} — your message ${it.turn}`,
        `> "${it.utterance}"`, ``, it.feedback, ``, `**You could say:** "${it.alternative}"`, ``,
      ]) : ['(none — nice work)']),
      ``, `## For your next real visit`,
      ...(rc.level1.next_visit_prep || []).map(b => `- ${b}`),
      ``, `**Your one goal:** ${rc.level1.goal_line}`,
    ].join('\n');
    dl(`pace-summary-${Date.now()}.md`, md, 'text/markdown');
  }

  // ── Init ────────────────────────────────────────────────────────────────
  buildMenu();
  buildSurvey();
  const urlPass = new URLSearchParams(location.search).get('pass');
  const stored = sessionStorage.getItem('pace2_passcode');
  if (urlPass || stored) {
    passcode = urlPass || stored;
    sessionStorage.setItem('pace2_passcode', passcode);
    ST.logTransition(S, 'gate', 'education', urlPass ? 'passcode via URL' : 'passcode via session');
    show('view-education');
  }

  window.App = { enterPasscode, toMenu, toSurvey, submitSurvey, startVisit, send, exitNow, downloadJSON, downloadReport };
})();
