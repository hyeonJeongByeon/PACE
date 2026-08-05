// PACE v2.1 engine — HANDOVER_SPEC_V2.md.
// survey (screener-driven assignment, §3.4) → instantiation (continuity
// contract, §4.3) → role-play (sticky yields §4.5, soft close §6.4,
// reinforcement-only live tips §8) → report card (anchored, gated, capped,
// intensity-calibrated, plain-register; §7). Aggregation rules live in
// aggregator.js (pure, unit-tested).

(function () {
  const CFG = window.PACE_CONFIG;
  const PR = window.PACE_PROMPTS;
  const SURVEY = window.PACE_SURVEY;
  const SEEDS = window.PACE_SCENARIO_SEEDS;
  const MISTAKES = window.PACE_MISTAKES;
  const REGISTER = window.PACE_REGISTER;
  const ST = window.PACE_STATE;
  const AGG = window.PACE_AGG;

  let S = ST.newSession(CFG);
  let passcode = '';
  let busy = false;
  let timerInterval = null;
  let openOpp = null;
  let yieldedBehaviors = [];   // sticky (§4.5)
  let closed = false;

  // ── LLM client (single swappable path — §10 CONFIRM) ────────────────────
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

  // ── Views / helpers ─────────────────────────────────────────────────────
  function show(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('topbar').style.display = id === 'view-gate' ? 'none' : 'flex';
    window.scrollTo(0, 0);
  }
  function esc(t) { return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function enterPasscode() {
    const v = document.getElementById('passcode-input').value.trim();
    if (!v) { document.getElementById('gate-err').textContent = 'Passcode required.'; return; }
    passcode = v;
    sessionStorage.setItem('pace21_passcode', v);
    ST.logTransition(S, 'gate', 'education');
    show('view-education');
  }

  // ── Survey (§3; NO scenario menu — §6.1) ────────────────────────────────
  function buildSurvey() {
    const A = document.getElementById('survey-partA');
    SURVEY.partA.forEach(item => {
      const q = document.createElement('div');
      q.className = 'q';
      let control = '';
      if (item.type === 'text') control = `<textarea id="sv-${item.key}" placeholder="${esc(item.placeholder)}"></textarea>${item.cue ? `<div class="cue">${esc(item.cue)}</div>` : ''}`;
      else if (item.type === 'select') control = `<select id="sv-${item.key}"><option value="">Choose…</option>${item.options.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
      else if (item.type === 'scale05') control = `<div class="scale05" id="sv-${item.key}">${[0,1,2,3,4,5].map(n => `<button type="button" data-v="${n}">${n}</button>`).join('')}<span class="mute" style="margin-left:.4rem">${esc(item.minLabel)} → ${esc(item.maxLabel)}</span></div>`;
      q.innerHTML = `<label class="qlabel">${esc(item.label)}</label>${control}`;
      A.appendChild(q);
      if (item.type === 'scale05') q.querySelectorAll('button').forEach(b => b.onclick = () => {
        q.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
      });
    });

    // current_treatments (§3.3 item 7, structured — pilot F5/F10)
    const T = document.getElementById('survey-treatments');
    const tcfg = SURVEY.currentTreatments;
    T.innerHTML = `<h2 style="margin-top:0">${esc(tcfg.label)}</h2><div class="mute" style="margin-bottom:.6rem">${esc(tcfg.sub)}</div><div id="tx-rows"></div><button type="button" class="tx-add" onclick="App.addTreatmentRow()">+ Add a medication or treatment</button>`;

    const B = document.getElementById('survey-partB');
    SURVEY.screener.forEach(item => {
      const row = document.createElement('div');
      row.className = 'likert-row';
      row.innerHTML = `<span>${esc(item.label)}</span>` +
        SURVEY.screenerScale.map(v => `<span class="opt"><input type="radio" name="${item.key}" value="${v}"></span>`).join('');
      B.appendChild(row);
    });

    const F = document.getElementById('survey-focus');
    F.innerHTML += `<div class="radio-list"><label class="qlabel" style="font-weight:600;font-size:.88rem">${esc(SURVEY.preferredFocus.label)}</label>` +
      SURVEY.preferredFocus.options.map(o => `<label><input type="radio" name="preferred_focus" value="${o.value}"> ${esc(o.label)}</label>`).join('') + '</div>';

    document.getElementById('survey-safety').innerHTML =
      `<div class="q" style="margin-bottom:0"><label class="qlabel">${esc(SURVEY.contentExclusions.label)}</label><textarea id="sv-content_exclusions" placeholder="${esc(SURVEY.contentExclusions.placeholder)}"></textarea></div>`;
  }

  function addTreatmentRow() {
    const tcfg = SURVEY.currentTreatments;
    const row = document.createElement('div');
    row.className = 'tx-row';
    row.innerHTML = `
      <input type="text" placeholder="Name or description" class="tx-name">
      <select class="tx-status">${tcfg.statusOptions.map(o => `<option>${esc(o)}</option>`).join('')}</select>
      <select class="tx-helped"><option value="">Did it help?</option>${tcfg.helpedOptions.map(o => `<option>${esc(o)}</option>`).join('')}</select>
      <button type="button" class="tx-del" onclick="this.parentElement.remove()">✕</button>`;
    document.getElementById('tx-rows').appendChild(row);
  }

  function toSurvey() { ST.logTransition(S, S.stage, 'survey'); show('view-survey'); }

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
    out.current_treatments = [...document.querySelectorAll('.tx-row')].map(r => ({
      name: r.querySelector('.tx-name').value.trim(),
      status: r.querySelector('.tx-status').value,
      helped: r.querySelector('.tx-helped').value || null,
    })).filter(t => t.name);
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
    S.preferred_focus = survey.preferred_focus;
    const { scores, total, assigned } = ST.assignComponent(survey);   // §3.4: screener-driven
    S.screener_scores = scores;
    S.screener_total = total;
    S.assigned_component = assigned;
    S.feedback_intensity = ST.feedbackIntensity(total, CFG);           // §7.7
    ST.logTransition(S, 'survey', 'instantiation',
      `assigned=${assigned} (screener ${JSON.stringify(scores)} total=${total}) preferred=${survey.preferred_focus} intensity=${S.feedback_intensity}`);
    show('view-generating');
    await instantiate();
  }

  // ── Stage 2 (§4) ────────────────────────────────────────────────────────
  async function instantiate() {
    const behaviors = SEEDS.COMPONENT_BEHAVIORS[S.assigned_component].slice(0, 2);
    const seed = SEEDS.seeds[SEEDS.COMPONENT_SEED[S.assigned_component]];
    try {
      const j = await callJSON(PR.instantiate(S.survey_responses, seed, behaviors, SEEDS.YIELD_LIBRARY, S.assigned_component, CFG), 1900, 1);
      if (!j.scenario || !j.persona || !Array.isArray(j.embedded_opportunities) || j.embedded_opportunities.length < 2) throw new Error('Incomplete scenario object');
      S.scenario = j.scenario;
      S.persona = j.persona;
      if (!Array.isArray(S.persona.yield_conditions) || !S.persona.yield_conditions.length) {
        S.persona.yield_conditions = behaviors.map(b => SEEDS.YIELD_LIBRARY[b]);
      }
      S.embedded_opportunities = j.embedded_opportunities.slice(0, CFG.MAX_OPPORTUNITIES)
        .map(o => ({ ...o, status: 'not_surfaced', detected: false, detected_at_turn: null }));
    } catch (e) {
      console.error('Instantiation failed, using fallback:', e);
      buildFallbackScenario(seed, behaviors);
    }
    ST.logTransition(S, 'instantiation', 'briefing', `opps=${S.embedded_opportunities.length}`);
    document.getElementById('brief-premise').textContent = S.scenario.premise;
    document.getElementById('brief-chart').innerHTML =
      (S.scenario.clinician_knows || []).map(f => `<li>${esc(f)}</li>`).join('') || '<li>(nothing yet)</li>';
    show('view-briefing');
  }

  function buildFallbackScenario(seed, behaviors) {
    const sv = S.survey_responses;
    S.scenario = {
      scenario_id: 'fallback',
      premise: `You are at a clinic visit about ${sv.problem_text} (going on for ${sv.problem_duration.toLowerCase()}). You hope the provider can ${sv.visit_goal}. You have one question you don't want to forget: "${sv.must_ask_question}".`,
      clinician_knows: [`Visit booked about: ${sv.problem_text}`],
      clinician_does_not_know: ['how long and how severe', 'impact on daily life', 'treatments tried', 'the worry and feared cause', 'the must-ask question'],
      opening_turn: `Hi, come on in. I see we're talking about ${sv.problem_text} today — tell me where things stand.`,
      target_component: S.assigned_component,
    };
    S.persona = {
      persona_id: 'fallback', display_name: 'Dr. Alvarez',
      description: seed.persona_seed,
      principles: [
        'Keep replies to 1–3 sentences of realistic visit dialogue.',
        'You know only what is in your chart. Do not reference prior treatments, test results, or history that are not in your chart. If you need information you do not have, ask for it.',
        'Never give real medical advice; all clinical content stays within this fictional practice scenario.',
        'Use at most one undefined medical term per reply, and only while the jargon behavior is active.',
      ],
      challenge_behaviors: behaviors,
      yield_conditions: behaviors.map(b => SEEDS.YIELD_LIBRARY[b]),
    };
    S.embedded_opportunities = [
      { id: 'opp_1', component: S.assigned_component, trigger: 'Create the natural moment for the target skill', expected_behavior: `Participant uses the ${S.assigned_component} skill`, status: 'not_surfaced', detected: false, detected_at_turn: null },
      { id: 'opp_2', component: 'P', trigger: 'Ask a lazy general question inviting detail', expected_behavior: 'Participant presents onset, severity, impact', status: 'not_surfaced', detected: false, detected_at_turn: null },
      { id: 'opp_3', component: 'A', trigger: 'Introduce a plan element briefly without explanation', expected_behavior: 'Participant asks about it', status: 'not_surfaced', detected: false, detected_at_turn: null },
    ];
  }

  // ── Stage 3 (§6) ────────────────────────────────────────────────────────
  function startVisit() {
    ST.logTransition(S, 'briefing', 'roleplay');
    S.visit.started_at = new Date().toISOString();
    S._visitStartMs = Date.now();
    document.getElementById('rp-name').textContent = S.persona.display_name;
    document.getElementById('situation-text').textContent = S.scenario.premise;
    document.getElementById('situation-strip').classList.remove('collapsed');
    show('view-roleplay');
    timerInterval = setInterval(tickTimer, 1000);
    pushMsg('clinician', S.scenario.opening_turn);
    setBusy(false);
  }

  function minutesLeft() { return Math.max(0, CFG.VISIT_MINUTES - (Date.now() - S._visitStartMs) / 60000); }
  function turnsLeft() { return Math.max(0, CFG.MAX_TURNS - S.visit.participant_turns); }

  function tickTimer() {
    const leftMs = Math.max(0, CFG.VISIT_MINUTES * 60000 - (Date.now() - S._visitStartMs));
    const m = Math.floor(leftMs / 60000), s = Math.floor((leftMs % 60000) / 1000);
    const el = document.getElementById('rp-timer');
    if (el) el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    // §6.4.1: warning state at 2 minutes remaining; not anxiogenic before.
    document.getElementById('timer-pill').classList.toggle('warning', leftMs <= CFG.WARN_MINUTES_LEFT * 60000 && !closed);
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
      div.innerHTML = `<div class="m-avatar">${entry.role === 'participant' ? 'You' : '🩺'}</div><div class="bubble">${esc(entry.text)}</div>`;
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
    inp.disabled = v || closed;
    btn.disabled = inp.disabled;
    if (!inp.disabled) inp.focus();
  }

  function transcriptFor(audience) {
    return S.transcript.map(m => {
      if (m.role === 'coach') return audience === 'annotator' ? `COACH (aside): ${m.text}` : null;
      if (m.role === 'participant') return `Patient (turn ${m.turn}): ${m.text}`;
      return `Clinician: ${m.text}`;
    }).filter(Boolean).join('\n');
  }

  async function send() {
    if (busy || closed) return;
    const inp = document.getElementById('chat-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    setBusy(true);
    if (S.visit.participant_turns === 0) document.getElementById('situation-strip').classList.add('collapsed');

    // §6.4 phases, computed BEFORE this turn is counted
    const capReached = S.visit.participant_turns >= CFG.MAX_TURNS || minutesLeft() <= 0;
    if (capReached) {
      S.visit.in_grace = true;
      S.visit.grace_turns_used++;
    }
    S.visit.in_wrapup = S.visit.in_wrapup || capReached ||
      minutesLeft() <= CFG.WARN_MINUTES_LEFT || turnsLeft() <= CFG.WRAPUP_TURNS_LEFT;

    pushMsg('participant', text, openOpp ? { opp_id: openOpp.id } : {});

    try {
      await clinicianTurn();
    } catch (e) {
      console.error(e);
      addError(e.message);
      setBusy(false);
    }
  }

  async function clinicianTurn() {
    showTyping(true);
    const activeBehaviors = (S.persona.challenge_behaviors || []).filter(b => !yieldedBehaviors.includes(b));
    const ctx = {
      turnsUsed: S.visit.participant_turns,
      turnsLeft: turnsLeft(),
      minutesLeft: minutesLeft(),
      inWrapup: S.visit.in_wrapup,
      inGrace: S.visit.in_grace,
      transcriptText: transcriptFor('clinician'),
      openOpp,
      remainingOpps: S.embedded_opportunities.filter(o => o.status === 'not_surfaced'),
      yieldedBehaviors,
      activeBehaviors,
    };

    // Step 1 — PLAN (also: opportunity status, sticky yields, must-ask)
    const plan = await callJSON(PR.planner(S, CFG, ctx), 380, 1);

    // Opportunity bookkeeping + §8 reinforcement-only live tips
    if (openOpp && ['met', 'partial', 'missed'].includes(plan.open_opportunity_status)) {
      const st = plan.open_opportunity_status;
      openOpp.status = st;
      openOpp.detected = st !== 'missed';
      openOpp.detected_at_turn = S.visit.participant_turns;
      S.transcript[S.transcript.length - 1].opp_status = st;
      if (st === 'met' && CFG.LIVE_TIPS && S.live_tips_sent.length < CFG.LIVE_TIPS_MAX) {
        showTyping(false);
        pushMsg('coach', PR.liveTip(openOpp.component), { opp_id: openOpp.id, live_tip: true });
        S.live_tips_sent.push({ turn: S.visit.participant_turns, opportunity_id: openOpp.id });
        showTyping(true);
      }
      openOpp = null;
    }

    // Sticky yields (§4.5): once yielded, off for the rest of the session.
    (plan.newly_yielded || []).forEach(b => {
      if ((S.persona.challenge_behaviors || []).includes(b) && !yieldedBehaviors.includes(b)) {
        yieldedBehaviors.push(b);
        S.yield_events.push({ behavior: b, turn: S.visit.participant_turns, met_by: 'participant' });
      }
    });
    if (plan.must_ask_asked) S.visit.must_ask_asked = true;

    // Grace cap (§6.4.4): after the allowed grace exchanges, force close.
    let move = plan.move;
    if (S.visit.in_grace && S.visit.grace_turns_used >= CFG.GRACE_EXTRA_TURNS) move = 'close';

    let oppToOpen = null;
    if (plan.opportunity_to_open && plan.opportunity_to_open !== 'null' && !['begin_wrapup', 'close'].includes(move)) {
      const o = S.embedded_opportunities.find(x => x.id === plan.opportunity_to_open && x.status === 'not_surfaced');
      if (o) { o.status = 'open'; oppToOpen = o; openOpp = o; }
    }

    // Step 2 — GENERATE
    const g = await callJSON(PR.generator(S, { ...plan, move }, { ...ctx, transcriptText: transcriptFor('clinician') }, oppToOpen), 350, 1);
    showTyping(false);
    pushMsg('clinician', g.message || '…', oppToOpen ? { opp_id: oppToOpen.id, opened: true } : {});

    if (move === 'close') return closeVisit('planned_close');
    setBusy(false);
  }

  // §6.4.4: input disables, ONE button appears. No automatic navigation.
  function closeVisit(how) {
    closed = true;
    clearInterval(timerInterval);
    S.visit.ended_at = new Date().toISOString();
    S.embedded_opportunities.forEach(o => { if (o.status === 'open') o.status = 'missed'; });

    // §6.4.5 resolution_state: yield condition met + must-ask asked.
    const behaviors = S.persona.challenge_behaviors || [];
    const yieldOk = behaviors.length === 0 || S.yield_events.length > 0;
    const resolved = yieldOk && S.visit.must_ask_asked;
    const early = S.visit.participant_turns <= CFG.MAX_TURNS - CFG.WRAPUP_TURNS_LEFT && minutesLeft() > CFG.WARN_MINUTES_LEFT;
    S.resolution_state = resolved ? (early ? 'resolved_early' : 'resolved_at_cap') : 'unresolved';

    ST.logTransition(S, 'roleplay', 'closed', `how=${how} resolution=${S.resolution_state} yields=${JSON.stringify(S.yield_events)} must_ask=${S.visit.must_ask_asked} tips=${S.live_tips_sent.length}`);
    setBusy(false);
    document.getElementById('chat-input-row').style.display = 'none';
    document.getElementById('see-results-row').style.display = 'block';
  }

  function toSummary() {
    ST.logTransition(S, 'closed', 'report');
    document.getElementById('summary-sub').textContent =
      `${S.persona.display_name} · ${S.visit.participant_turns} messages`;
    show('view-summary');
    generateReport();
  }

  function exitNow() {
    if (S.stage === 'roleplay' && S.visit.participant_turns >= 1 && !closed) {
      S.visit.exited_early = true;
      closeVisit('participant_exit');
      toSummary();          // exit goes straight to the (partial) summary
    } else if (S.stage === 'closed') {
      toSummary();
    } else {
      clearInterval(timerInterval);
      ST.logTransition(S, S.stage, 'exited');
      show('view-exited');
    }
  }

  // ── Stage 4 (§7) ────────────────────────────────────────────────────────
  function progress(msg) {
    const el = document.getElementById('summary-progress');
    if (el) el.textContent = msg;
  }

  async function generateReport() {
    let ann = null;
    try {
      progress('Looking back over your visit…');
      ann = await callJSON(PR.annotator(S, MISTAKES, REGISTER, transcriptFor('annotator'), null), 1900, 1);
    } catch (e) { console.error('Annotator failed:', e); }

    S.turn_annotations = ann?.annotations || [];
    const globalChecks = ann?.global_checks || { must_ask_question_asked: S.visit.must_ask_asked, worry_voiced: true };
    (ann?.opportunity_review || []).forEach(r => {
      const o = S.embedded_opportunities.find(x => x.id === r.id);
      if (o && ['met', 'partial', 'missed', 'not_surfaced'].includes(r.status)) o.status = r.status;
    });

    // §7.5 anchoring + §7.2 gate (pure functions, unit-tested)
    const { kept, dropped } = AGG.anchorFilter(S.turn_annotations, S.embedded_opportunities, globalChecks, S.survey_responses.worry_level);
    S.dropped_annotations = dropped;   // researcher inspection log (§10)

    // §7.6 caps (+ §7.7 intensity)
    const level3 = AGG.pickLevel3(kept, S.embedded_opportunities, S.feedback_intensity,
      { standard: CFG.MAX_LEVEL3_STANDARD, light: CFG.MAX_LEVEL3_LIGHT });
    await qaFilter(level3);

    const level2 = ['P', 'A', 'C', 'E'].map(k => AGG.buildLevel2(k, MISTAKES[k], S.embedded_opportunities, S.turn_annotations));
    const componentSummaries = level2.map(l => `${l.component}: ${l.noChance ? 'no chance to practice' : l.statusLine}`).join(' | ');

    let level1 = null;
    try {
      progress('Writing your next-visit notes…');
      level1 = await callJSON(PR.overview(S, REGISTER, componentSummaries), 700, 1);
    } catch (e) { console.error('Overview failed:', e); }

    S.report_card = {
      level1: level1 || {
        overview: 'You finished a full practice visit — everything you did is saved in your download below.',
        next_visit_prep: [`Bring your must-ask question written down: "${S.survey_responses.must_ask_question}"`],
        goal_line: 'Carry one of these skills into your next real visit.',
      },
      level2, level3,
      feedback_intensity: S.feedback_intensity,
      generated_at: new Date().toISOString(),
    };
    renderReport();
  }

  function substitutedTranscript(turn, alternative) {
    return S.transcript.map(m => {
      if (m.role === 'coach') return null;
      if (m.role === 'participant') return `Patient (turn ${m.turn}): ${m.turn === turn ? alternative : m.text}`;
      return `Clinician: ${m.text}`;
    }).filter(Boolean).join('\n');
  }

  async function qaFilter(items) {
    // §7.6 substitution QA: regenerate once, drop on second failure.
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
        items.splice(i, 1);
      } catch (e) { /* keep item on QA infrastructure failure */ }
    }
  }

  const CHIP = { met: 'met', partial: 'partial', missed: 'missed', not_surfaced: 'none', open: 'none' };
  const CHIP_LABEL = { met: 'Tried it', partial: 'Partially', missed: 'A moment slipped by', not_surfaced: 'Didn\'t come up', open: 'Didn\'t come up' };

  function renderReport() {
    const rc = S.report_card;
    const body = document.getElementById('summary-body');
    let html = `<div class="level-tag">Overview</div>
      <div class="card" style="font-size:.92rem;line-height:1.65">${esc(rc.level1.overview)}</div>`;

    html += `<div class="level-tag">Skill by skill</div>`;
    for (const l of rc.level2) {
      const target = l.component === S.assigned_component ? ` <span class="chip" style="background:var(--accent-soft);color:var(--accent)">today's focus</span>` : '';
      html += `<div class="card">
        <div class="comp-head"><div class="pace-letter ${l.component}" style="width:30px;height:30px;flex:0 0 30px;font-size:.85rem">${l.component}</div>
          <b>${esc(l.gloss)}${target}</b>
          ${l.noChance ? '' : l.opportunities.map(o => `<span class="chip ${CHIP[o.status] || 'none'}">${CHIP_LABEL[o.status] || o.status}</span>`).join(' ')}
        </div>
        <div class="report-row">${esc(l.statusLine)}</div>
      </div>`;
    }

    if (rc.level3.length) {
      html += `<div class="level-tag">${rc.level3.length === 1 ? 'One moment worth a second look' : 'Moments worth a second look'}</div>`;
      for (const it of rc.level3) {
        html += `<div class="card">
          <div class="comp-head"><div class="pace-letter ${it.component}" style="width:30px;height:30px;flex:0 0 30px;font-size:.85rem">${it.component}</div><b>${esc(MISTAKES[it.component].gloss)}</b><span class="mute">your message ${it.turn}</span></div>
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
  function downloadJSON() { dl(`${S.session_id}.json`, JSON.stringify(S, null, 2), 'application/json'); }
  function downloadReport() {
    const rc = S.report_card;
    const md = [
      `# How your practice visit went`,
      `${new Date().toLocaleDateString()} · ${S.persona.display_name} · practice visit (simulation — not medical advice)`,
      ``, `## Overview`, rc.level1.overview, ``,
      `## Skill by skill`,
      ...rc.level2.map(l => `- **${l.gloss}** — ${l.statusLine}`),
      ``,
      ...(rc.level3.length ? [`## Moments worth a second look`,
        ...rc.level3.flatMap(it => [`### ${MISTAKES[it.component].gloss} — your message ${it.turn}`, `> "${it.utterance}"`, ``, it.feedback, ``, `**You could say:** "${it.alternative}"`, ``])] : []),
      `## For your next real visit`,
      ...(rc.level1.next_visit_prep || []).map(b => `- ${b}`),
      ``, `**Your one goal:** ${rc.level1.goal_line}`,
    ].join('\n');
    dl(`pace-summary-${Date.now()}.md`, md, 'text/markdown');
  }

  // ── Init ────────────────────────────────────────────────────────────────
  buildSurvey();
  const urlPass = new URLSearchParams(location.search).get('pass');
  const stored = sessionStorage.getItem('pace21_passcode');
  if (urlPass || stored) {
    passcode = urlPass || stored;
    sessionStorage.setItem('pace21_passcode', passcode);
    ST.logTransition(S, 'gate', 'education', urlPass ? 'passcode via URL' : 'passcode via session');
    show('view-education');
  }

  window.App = { enterPasscode, toSurvey, submitSurvey, startVisit, send, exitNow, toSummary, addTreatmentRow, downloadJSON, downloadReport };
})();
