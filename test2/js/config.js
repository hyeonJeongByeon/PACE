// PACE v2.1 configuration (HANDOVER_SPEC_V2.md). Researcher-editable.
window.PACE_CONFIG = {
  PROXY_URL: 'https://pace-proxy.pace-formative.workers.dev',

  // §6.1 hard constraints + §6.4 soft close
  MAX_TURNS: 12,             // participant turns
  VISIT_MINUTES: 10,         // countdown budget
  WARN_MINUTES_LEFT: 2,      // timer changes to warning state (§6.4.1)
  WRAPUP_TURNS_LEFT: 3,      // wrap-up phase when ≤ this many turns remain (§6.4.2)
  GRACE_EXTRA_TURNS: 2,      // max extra turns past the cap (§6.4.4)

  // §7.7 screener-calibrated feedback intensity — CONFIRM(§9.6): LIGHT_MAX
  // threshold is an advisor decision; default per spec.
  LIGHT_MAX: 4,              // screener_total ≤ LIGHT_MAX → "light"

  // §8 live tips — reinforcement-only. CONFIRM(§9.7): default on for the
  // formative study per spec; set false if the advisor prefers.
  LIVE_TIPS: true,
  LIVE_TIPS_MAX: 2,

  // §5.1 onboarding mode
  SESSION_MODE: 'facilitated',   // facilitated | self_serve

  // §7.6 volume caps (enforced in aggregator code)
  MAX_LEVEL3_STANDARD: 4,    // one per component, four total
  MAX_LEVEL3_LIGHT: 1,       // single highest-leverage item

  // Stage-2 instantiation
  MIN_OPPORTUNITIES: 3,
  MAX_OPPORTUNITIES: 5,
};
