// PACE interview build — engine.
// Flow: education → one topic question → instantiation → role-play with a
// live coach (right-side panel, natural judgment, optional retry) → summary.

(function () {
  const CFG = window.PACE_CONFIG;
  const PR = window.PACE_PROMPTS;
  const SURVEY = window.PACE_SURVEY;
  const MISTAKES = window.PACE_MISTAKES;
  const REGISTER = window.PACE_REGISTER;
  const ST = window.PACE_STATE;

  let S = ST.newSession(CFG);
  let passcode = '';
  let busy = false;
  let timerInterval = null;
  let closed = false;
  let turnSeq = 0;              // labels every participant message, retries included
  let praisedSkills = [];
  let improveCount = 0;
  let coachedLastTurn = false;
  let skipCoachOnce = false;    // after a retry, the clinician answers directly
  let pendingRetry = null;      // {entryIndex, coachEvent}

  // ── LLM client ──────────────────────────────────────────────────────────
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

  // ── Session logging to Google Sheets (fire-and-forget, never blocks UX) ──
  function transcriptPlain() {
    return S.transcript.map(m => {
      const who = m.role === 'clinician' ? (S.persona ? S.persona.display_name : 'Doctor')
        : m.role === 'coach' ? 'Coach' : 'You';
      return `${who}${m.retracted ? ' (retried)' : ''}: ${m.text}`;
    }).join('\n');
  }

  function logToSheet(event) {
    if (!CFG.LOG_ENDPOINT) return;
    const clip = (t, n) => (t || '').slice(0, n || 45000);
    const payload = {
      event,
      session_id: S.session_id,
      topic: clip(S.problem_text, 500),
      scenario_seed: S.chosen_seed || '',
      resolution: S.resolution_state || '',
      turns: S.visit.participant_turns || 0,
      coach_notes: S.coach_events.length,
      transcript_text: clip(transcriptPlain()),
      report_json: clip(JSON.stringify(S.report_card || null)),
      session_json: clip(JSON.stringify(S)),
    };
    try {
      // text/plain keeps it a simple request (no CORS preflight); the
      // response is opaque and ignored on purpose.
      fetch(CFG.LOG_ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, body: JSON.stringify(payload) });
    } catch (e) { console.warn('sheet log failed', e); }
  }

  // Best-effort partial log if the tab closes mid-visit
  window.addEventListener('pagehide', () => {
    if (S.stage === 'roleplay' && S.visit.participant_turns > 0) logToSheet('abandoned_midvisit');
  });

  // ── Views ───────────────────────────────────────────────────────────────
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
    sessionStorage.setItem('paceiv_passcode', v);
    ST.logTransition(S, 'gate', 'education');
    show('view-education');
  }

  // ── Topic question ──────────────────────────────────────────────────────
  function buildSurvey() {
    const t = SURVEY.problemText;
    document.getElementById('topic-label').textContent = t.label;
    document.getElementById('topic-sub').textContent = t.sub;
    document.getElementById('topic-cue').textContent = t.cue;
    document.getElementById('sv-problem_text').placeholder = t.placeholder;
  }
  function toSurvey() { ST.logTransition(S, S.stage, 'survey'); show('view-survey'); }

  function submitSurvey() {
    const v = document.getElementById('sv-problem_text').value.trim();
    if (!v) { document.getElementById('survey-err').textContent = 'Please enter a health concern to practice with.'; return; }
    S.problem_text = v;
    ST.logTransition(S, 'survey', 'menu');
    show('view-menu');
  }

  // ── Scenario choice (five options) ──────────────────────────────────────
  let chosenSeed = null;
  function buildMenu() {
    const list = document.getElementById('seed-list');
    window.PACE_SCENARIO_SEEDS.forEach(seed => {
      const el = document.createElement('div');
      el.className = 'card scenario-card';
      el.innerHTML = `<b style="font-size:.9rem">${esc(seed.title)}</b>
        <div style="font-size:.85rem;color:var(--ink-soft);margin-top:.25rem">${esc(seed.menuDescription)}</div>`;
      el.onclick = () => {
        document.querySelectorAll('#seed-list .scenario-card').forEach(c => c.classList.remove('sel'));
        el.classList.add('sel');
        chosenSeed = seed;
        document.getElementById('menu-next').disabled = false;
      };
      list.appendChild(el);
    });
  }

  async function chooseScenario() {
    if (!chosenSeed) return;
    S.chosen_seed = chosenSeed.id;
    ST.logTransition(S, 'menu', 'instantiation', `seed=${chosenSeed.id}`);
    show('view-generating');
    await instantiate();
  }

  // ── Instantiation ───────────────────────────────────────────────────────
  async function instantiate() {
    try {
      const j = await callJSON(PR.instantiate(S.problem_text, chosenSeed, REGISTER), 1300, 1);
      if (!j.scenario || !j.persona) throw new Error('Incomplete scenario');
      S.scenario = j.scenario;
      S.persona = j.persona;
    } catch (e) {
      console.error('Instantiation failed, using fallback:', e);
      S.scenario = {
        premise: `You are at a clinic visit about ${S.problem_text}. The clinic has your name and the topic on the schedule; the details are yours to bring. You would like to leave with a clearer picture and a plan you understand.`,
        clinician_knows: [`Visit booked about: ${S.problem_text}`],
        clinician_does_not_know: ['how long and how it feels', 'what has been tried', 'what the patient hopes for'],
        opening_turn: `Hi, come on in. I see we're talking about ${S.problem_text} today. Tell me where things stand.`,
      };
      S.persona = {
        display_name: 'Dr. Alvarez',
        description: (chosenSeed && chosenSeed.persona_seed) || 'An ordinary, capable clinician on a busy day. Friendly but brief; explains well when asked.',
        principles: [
          'You know only what is in your chart. Do not reference treatments, results, or history that are not in your chart. If you need information you do not have, ask for it.',
          'Never give real medical advice; all clinical content stays within this fictional practice scenario.',
          'Keep replies to 1 to 3 sentences of realistic spoken visit dialogue, with at most one unexplained medical term per reply.',
        ],
      };
    }
    ST.logTransition(S, 'instantiation', 'briefing');
    document.getElementById('brief-premise').textContent = S.scenario.premise;
    document.getElementById('brief-chart').innerHTML =
      (S.scenario.clinician_knows || []).map(f => `<li>${esc(f)}</li>`).join('') || '<li>(nothing yet)</li>';
    show('view-briefing');
  }

  // ── Role-play ───────────────────────────────────────────────────────────
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
  function effectiveTurns() { return S.transcript.filter(m => m.role === 'participant' && !m.retracted).length; }

  function tickTimer() {
    const leftMs = Math.max(0, CFG.VISIT_MINUTES * 60000 - (Date.now() - S._visitStartMs));
    const m = Math.floor(leftMs / 60000), s = Math.floor((leftMs % 60000) / 1000);
    const el = document.getElementById('rp-timer');
    if (el) el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    document.getElementById('timer-pill').classList.toggle('warning', leftMs <= CFG.WARN_MINUTES_LEFT * 60000 && !closed);
  }

  function phase() {
    if (S.visit.in_grace && S.visit.grace_turns_used >= CFG.GRACE_EXTRA_TURNS) return 'close';
    if (S.visit.in_grace) return 'grace';
    if (S.visit.in_wrapup) return 'wrapup';
    return 'normal';
  }

  function pushMsg(role, text, extra) {
    const entry = Object.assign({ ts: new Date().toISOString(), role, text }, extra || {});
    if (role === 'participant') entry.turn = ++turnSeq;
    S.transcript.push(entry);
    renderMsg(entry);
    return S.transcript.length - 1;
  }

  function renderMsg(entry) {
    const log = document.getElementById('chat-log');
    const div = document.createElement('div');
    div.className = `msg ${entry.role === 'participant' ? 'participant' : ''}`;
    div.dataset.idx = S.transcript.indexOf(entry);
    div.innerHTML = `<div class="m-avatar">${entry.role === 'participant' ? 'You' : '🩺'}</div><div class="bubble">${esc(entry.text)}</div>`;
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

  // Clinician never sees coach asides, retracted messages, or its own repeats.
  function transcriptFor(audience) {
    return S.transcript.map(m => {
      if (m.role === 'participant') {
        if (m.retracted && audience !== 'annotator') return null;
        return `Patient (turn ${m.turn})${m.retracted ? ' [retracted, replaced by the retry below]' : ''}: ${m.text}`;
      }
      if (m.repeat_of != null && audience !== 'annotator') return null;
      return `Clinician${m.repeat_of != null ? ' (repeating)' : ''}: ${m.text}`;
    }).filter(Boolean).join('\n');
  }

  // ── Coach notes: inline in the conversation, next to the message they
  // refer to, so they scroll up with the chat ──────────────────────────────
  let pendingNoteEl = null;
  function addCoachNote(type, message, withActions) {
    const log = document.getElementById('chat-log');
    const div = document.createElement('div');
    div.className = 'coach-note inline' + (type === 'praise' ? ' praise' : '');
    div.innerHTML = `<div style="font-size:.66rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:.15rem;color:${type === 'praise' ? 'var(--good)' : 'var(--coach)'}">🎓 Coach</div><div>${esc(message)}</div>` + (withActions ? `
      <div class="cn-actions">
        <button class="cp-btn cp-yes" onclick="App.retryYes()">Try again</button>
        <button class="cp-btn cp-no" onclick="App.retryNo()">Keep going</button>
      </div>` : '');
    log.appendChild(div);
    if (withActions) pendingNoteEl = div;
    log.scrollTop = log.scrollHeight;
  }
  function clearNoteActions() {
    if (pendingNoteEl) {
      const a = pendingNoteEl.querySelector('.cn-actions');
      if (a) a.remove();
      pendingNoteEl = null;
    }
  }

  // ── Send flow ───────────────────────────────────────────────────────────
  async function send() {
    if (busy || closed) return;
    const inp = document.getElementById('chat-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    setBusy(true);
    if (effectiveTurns() === 0) document.getElementById('situation-strip').classList.add('collapsed');

    // clock phases, before this turn counts
    const capReached = effectiveTurns() >= CFG.MAX_TURNS || minutesLeft() <= 0;
    if (capReached) { S.visit.in_grace = true; S.visit.grace_turns_used++; }
    S.visit.in_wrapup = S.visit.in_wrapup || capReached ||
      minutesLeft() <= CFG.WARN_MINUTES_LEFT || (CFG.MAX_TURNS - effectiveTurns()) <= CFG.WRAPUP_TURNS_LEFT;

    const entryIndex = pushMsg('participant', text);
    showTyping(true); // the doctor is "there" the whole time the app is working

    try {
      if (!skipCoachOnce) {
        const decision = await coachJudge(text);
        if (decision) {
          const handled = await handleCoach(decision, entryIndex);
          if (handled === 'waiting') { showTyping(false); return; } // paused for the retry choice
        } else {
          coachedLastTurn = false; // reset so the coach can speak on a later turn
        }
      } else {
        skipCoachOnce = false;
        coachedLastTurn = false;
      }
      await clinicianTurn(false);
    } catch (e) {
      console.error(e);
      showTyping(false);
      addError(e.message);
      setBusy(false);
    }
  }

  async function coachJudge(lastPatient) {
    const lastClin = [...S.transcript].reverse().find(m => m.role === 'clinician');
    try {
      const d = await callJSON(PR.coachJudge(S, MISTAKES, REGISTER, {
        transcriptText: transcriptFor('annotator'),
        lastClinician: lastClin ? lastClin.text : '',
        lastPatient,
        praisedSkills,
        improveCount,
        coachedLastTurn,
      }), 300, 0);
      if (!d || d.intervene === 'none' || !d.message) return null;
      if (d.intervene === 'praise' && (praisedSkills.includes(d.skill) || coachedLastTurn)) return null;
      if (d.intervene === 'improve' && (improveCount >= CFG.COACH_IMPROVE_MAX || coachedLastTurn)) return null;
      return d;
    } catch (e) { return null; } // coach failure never blocks the visit
  }

  async function handleCoach(d, entryIndex) {
    const event = {
      turn: S.transcript[entryIndex].turn, type: d.intervene, skill: d.skill,
      message: d.message, retry_offered: false, retry_taken: false,
    };
    S.coach_events.push(event);
    coachedLastTurn = true;

    if (d.intervene === 'praise') {
      praisedSkills.push(d.skill);
      addCoachNote('praise', d.message, false);
      return 'shown';
    }

    improveCount++;
    if (d.worth_retry && !closed && !S.visit.in_grace) {
      event.retry_offered = true;
      pendingRetry = { entryIndex, event };
      addCoachNote('improve', d.message + ' Want to try that again?', true);
      return 'waiting'; // input stays disabled until they choose
    }
    addCoachNote('improve', d.message, false);
    return 'shown';
  }

  function retryYes() {
    if (!pendingRetry) return;
    pendingRetry.event.retry_taken = true;
    const { entryIndex } = pendingRetry;
    S.transcript[entryIndex].retracted = true;
    const bubble = document.querySelector(`.msg[data-idx="${entryIndex}"]`);
    if (bubble) bubble.classList.add('retracted');
    const lastClin = [...S.transcript].reverse().find(m => m.role === 'clinician' && m.repeat_of == null);
    pushMsg('clinician', lastClin ? lastClin.text : '', { repeat_of: lastClin ? S.transcript.indexOf(lastClin) : null });
    clearNoteActions();
    pendingRetry = null;
    skipCoachOnce = true;   // the retry goes straight to the clinician
    setBusy(false);
  }

  async function retryNo() {
    if (!pendingRetry) return;
    pendingRetry = null;
    clearNoteActions();
    try { await clinicianTurn(false); }
    catch (e) { addError(e.message); setBusy(false); }
  }

  async function clinicianTurn(repeatLast) {
    showTyping(true);
    const j = await callJSON(PR.clinician(S, {
      transcriptText: transcriptFor('clinician'),
      phase: phase(),
      repeatLast,
    }), 320, 1);
    showTyping(false);
    pushMsg('clinician', j.message || '…');
    if (j.move === 'close' || phase() === 'close') return closeVisit('clinician_close');
    setBusy(false);
  }

  function closeVisit(how) {
    closed = true;
    clearInterval(timerInterval);
    S.visit.ended_at = new Date().toISOString();
    S.visit.participant_turns = effectiveTurns();
    S.resolution_state = how === 'participant_exit' ? 'exited'
      : (S.visit.in_grace || minutesLeft() <= 0 || effectiveTurns() >= CFG.MAX_TURNS) ? 'closed_at_cap' : 'closed_natural';
    ST.logTransition(S, 'roleplay', 'closed', `how=${how} resolution=${S.resolution_state} turns=${S.visit.participant_turns} coach=${S.coach_events.length}`);
    setBusy(true);
    clearNoteActions();
    logToSheet('visit_closed');
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
    if (S.stage === 'roleplay' && effectiveTurns() >= 1 && !closed) {
      S.visit.exited_early = true;
      closeVisit('participant_exit');
      toSummary();
    } else if (S.stage === 'closed') {
      toSummary();
    } else {
      clearInterval(timerInterval);
      ST.logTransition(S, S.stage, 'exited');
      show('view-exited');
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────
  function progress(msg) {
    const el = document.getElementById('summary-progress');
    if (el) el.textContent = msg;
  }

  async function generateReport() {
    let ann = null;
    try {
      progress('Looking back over your visit…');
      ann = await callJSON(PR.annotator(S, MISTAKES, REGISTER, transcriptFor('annotator')), 1800, 1);
    } catch (e) { console.error('Annotator failed:', e); }
    S.turn_annotations = ann?.annotations || [];

    // appropriateness gate + one item per skill, capped
    const negatives = S.turn_annotations.filter(a =>
      a.appropriate === false && Array.isArray(a.bad_areas) && a.feedback && a.alternative &&
      !S.transcript.some(m => m.role === 'participant' && m.turn === a.turn && m.retracted));
    const level3 = [];
    for (const comp of ['P', 'A', 'C', 'E']) {
      if (level3.length >= CFG.MAX_LEVEL3) break;
      const c = negatives.filter(a => a.bad_areas.includes(comp)).sort((a, b) => a.turn - b.turn)[0];
      if (c && !level3.some(i => i.turn === c.turn)) {
        level3.push({ component: comp, turn: c.turn, utterance: c.utterance, feedback: c.feedback, alternative: c.alternative });
      }
    }
    await qaFilter(level3);

    const level2 = ['P', 'A', 'C', 'E'].map(k => {
      const good = S.turn_annotations.filter(a => (a.good_areas || []).includes(k)).length;
      const bad = negatives.filter(a => a.bad_areas.includes(k)).length;
      const praised = S.coach_events.some(e => e.type === 'praise' && e.skill === k);
      const retried = S.coach_events.some(e => e.skill === k && e.retry_taken);
      let statusLine;
      if (!good && !bad && !praised) statusLine = `This one didn't really come up this visit.`;
      else {
        const bits = [];
        if (good) bits.push(`you used this well in ${good} message${good > 1 ? 's' : ''}`);
        if (retried) bits.push('you gave one moment a second try and improved it');
        if (bad) bits.push(`${bad} chance${bad > 1 ? 's' : ''} slipped by`);
        statusLine = bits.join(', ') + '.';
        statusLine = statusLine.charAt(0).toUpperCase() + statusLine.slice(1);
      }
      return { component: k, gloss: MISTAKES[k].gloss, goodCount: good, badCount: bad, praised, statusLine };
    });

    const componentSummaries = level2.map(l => `${l.component}: ${l.statusLine}`).join(' | ');
    let level1 = null;
    try {
      progress('Writing your next-visit notes…');
      level1 = await callJSON(PR.overview(S, REGISTER, componentSummaries), 700, 1);
    } catch (e) { console.error('Overview failed:', e); }

    S.report_card = {
      level1: level1 || {
        strengths: 'You finished a full practice visit. Everything you did is saved in the download below.',
        growth: '',
        next_visit_prep: ['Write your main question down before your next appointment.'],
      },
      level2, level3,
      generated_at: new Date().toISOString(),
    };
    renderReport();
    logToSheet('report_ready');
  }

  function substitutedTranscript(turn, alternative) {
    return S.transcript.map(m => {
      if (m.role === 'participant') {
        if (m.retracted) return null;
        return `Patient (turn ${m.turn}): ${m.turn === turn ? alternative : m.text}`;
      }
      if (m.repeat_of != null) return null;
      return `Clinician: ${m.text}`;
    }).filter(Boolean).join('\n');
  }

  async function qaFilter(items) {
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
          if (check.appropriate === true) { it.alternative = regen.alternative; continue; }
        }
        items.splice(i, 1);
      } catch (e) { /* keep item if QA infrastructure fails */ }
    }
  }

  function fullTurnText(turn) {
    const m = S.transcript.find(x => x.role === 'participant' && x.turn === turn);
    return m ? m.text : null;
  }

  function renderReport() {
    const rc = S.report_card;
    const body = document.getElementById('summary-body');

    // turn → skill map for highlights (coach notes + report excerpts)
    const turnSkill = {};
    S.coach_events.forEach(e => { if (e.turn != null && !turnSkill[e.turn]) turnSkill[e.turn] = e.skill; });
    rc.level3.forEach(it => { if (!turnSkill[it.turn]) turnSkill[it.turn] = it.component; });
    const goodPicks = {};
    for (const l of rc.level2) {
      if (rc.level3.some(it => it.component === l.component)) continue;
      const good = (S.turn_annotations || []).find(a => a.appropriate === true && (a.good_areas || []).includes(l.component));
      if (good) { goodPicks[l.component] = good; if (!turnSkill[good.turn]) turnSkill[good.turn] = l.component; }
    }

    // ── Left pane: the whole conversation ──
    const coachByTurn = {};
    S.coach_events.forEach(e => { (coachByTurn[e.turn] = coachByTurn[e.turn] || []).push(e); });
    let convo = '<div class="cv-head">Your conversation</div>';
    for (const m of S.transcript) {
      if (m.role === 'coach') continue;
      if (m.role === 'clinician') {
        convo += `<div class="cv-msg cv-doc"><div class="cv-who">${esc(S.persona.display_name)}</div>${esc(m.text)}</div>`;
      } else {
        const sk = turnSkill[m.turn];
        convo += `<div class="cv-msg cv-pat${m.retracted ? ' cv-retracted' : ''}${sk && !m.retracted ? ' sk-' + sk : ''}"><div class="cv-who">You</div>${esc(m.text)}</div>`;
        (coachByTurn[m.turn] || []).forEach(e => {
          convo += `<div class="cv-coach sk-${e.skill}">🎓 ${esc(e.message)}</div>`;
        });
      }
    }

    // ── Right pane: the summary ──
    let sum = `<div class="level-tag" style="margin-top:0">Overview</div>
      <div class="card" style="font-size:.92rem;line-height:1.65">
        <div class="report-row" style="margin-top:0"><b>What went well:</b> ${esc(rc.level1.strengths || rc.level1.overview || '')}</div>
        ${rc.level1.growth ? `<div class="report-row"><b>Something to build on:</b> ${esc(rc.level1.growth)}</div>` : ''}
      </div>`;

    sum += `<div class="level-tag">Skill by skill</div>`;
    for (const l of rc.level2) {
      const neg = rc.level3.find(it => it.component === l.component);
      let excerpt = '';
      if (neg) {
        const quote = fullTurnText(neg.turn) || neg.utterance;
        excerpt = `
          <div class="l3-quote sk-${l.component}">"${esc(quote)}"</div>
          <div class="report-row">${esc(neg.feedback)}</div>
          <div class="l3-alt">You might consider saying: "${esc(neg.alternative)}"</div>`;
      } else if (goodPicks[l.component]) {
        const good = goodPicks[l.component];
        const quote = fullTurnText(good.turn) || good.utterance;
        const praise = S.coach_events.find(e => e.type === 'praise' && e.skill === l.component);
        excerpt = `
          <div class="l3-quote sk-${l.component}">"${esc(quote)}"</div>
          <div class="report-row">${esc(praise ? praise.message : 'This one landed well. Keep doing this.')}</div>`;
      }
      sum += `<div class="card">
        <div class="comp-head"><div class="pace-letter ${l.component}" style="width:30px;height:30px;flex:0 0 30px;font-size:.85rem">${l.component}</div>
          <b>${esc(l.gloss)}</b>
          ${l.praised ? '<span class="chip met">Coach liked this</span>' : ''}
        </div>
        <div class="report-row">${esc(l.statusLine)}</div>
        ${excerpt}
      </div>`;
    }

    sum += `<div class="level-tag">For your next visit</div>
      <div class="card"><ul style="padding-left:1.1rem;font-size:.88rem;line-height:1.7">${(rc.level1.next_visit_prep || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>`;

    body.innerHTML = `<div class="summary-layout">
      <div class="convo-pane">${convo}</div>
      <div>${sum}</div>
    </div>`;
    document.getElementById('summary-tools').style.display = 'flex';
  }

  // ── Downloads ───────────────────────────────────────────────────────────
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
      `${new Date().toLocaleDateString()} · ${S.persona.display_name} · practice visit (simulation, not medical advice)`,
      ``, `## Overview`,
      `**What went well:** ${rc.level1.strengths || ''}`,
      ...(rc.level1.growth ? [`**Something to build on:** ${rc.level1.growth}`] : []),
      ``, `## Skill by skill`,
      ...rc.level2.flatMap(l => {
        const neg = rc.level3.find(it => it.component === l.component);
        const rows = [`### ${l.gloss}`, l.statusLine];
        if (neg) rows.push(`> "${fullTurnText(neg.turn) || neg.utterance}"`, ``, neg.feedback, ``, `**You might consider saying:** "${neg.alternative}"`);
        rows.push(``);
        return rows;
      }),
      `## For your next visit`,
      ...(rc.level1.next_visit_prep || []).map(b => `- ${b}`),
    ].join('\n');
    dl(`pace-summary-${Date.now()}.md`, md, 'text/markdown');
  }

  // ── Init ────────────────────────────────────────────────────────────────
  buildSurvey();
  buildMenu();
  const urlPass = new URLSearchParams(location.search).get('pass');
  const stored = sessionStorage.getItem('paceiv_passcode');
  if (urlPass || stored) {
    passcode = urlPass || stored;
    sessionStorage.setItem('paceiv_passcode', passcode);
    ST.logTransition(S, 'gate', 'education', urlPass ? 'passcode via URL' : 'passcode via session');
    show('view-education');
  }

  window.App = { enterPasscode, toSurvey, submitSurvey, chooseScenario, startVisit, send, exitNow, toSummary, retryYes, retryNo, downloadJSON, downloadReport };
})();
