// PACE study proxy — Vercel serverless function.
// The ONLY place the Anthropic API key lives (as a Vercel environment
// variable). Replaces the earlier Cloudflare Worker; same contract:
//  - study passcode required (x-study-passcode header)
//  - model pinned server-side, max_tokens capped
//  - basic per-IP rate limiting (in-memory per instance; adequate for N=20)
//
// Environment variables (set in Vercel → Project → Settings → Environment
// Variables, or via `vercel env add`): ANTHROPIC_API_KEY, STUDY_PASSCODE

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_CAP = 2000;

const RATE_LIMIT = { windowMs: 60_000, max: 30 };
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < RATE_LIMIT.windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT.max;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const passcode = req.headers['x-study-passcode'] || '';
  if (!process.env.STUDY_PASSCODE || passcode !== process.env.STUDY_PASSCODE) {
    return res.status(401).json({ error: 'Invalid or missing study passcode' });
  }

  const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded, wait a minute and retry' });
  }

  const { system, messages, max_tokens } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] required' });
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: Math.min(max_tokens || 800, MAX_TOKENS_CAP),
      ...(system ? { system } : {}),
      messages,
    }),
  });

  const data = await upstream.json();
  return res.status(upstream.status).json(data);
}
