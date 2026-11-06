import express from 'express';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { bots, leads, usage, inquiries, stats, PLANS } from './db.js';
import { chat } from './ai.js';

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const pub = path.resolve('public');

if (!ADMIN_PASSWORD) console.warn('⚠  ADMIN_PASSWORD is not set — the admin dashboard is disabled until you set it.');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));

// ---------- helpers ----------
const cors = (req, res, next) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
};

const hits = new Map(); // naive in-memory rate limiter: key -> {n, reset}
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
  return ++h.n <= max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, 60_000).unref();

function requireAdmin(req, res, next) {
  const given = Buffer.from(String(req.get('x-admin-key') || ''));
  const want = Buffer.from(ADMIN_PASSWORD);
  if (!ADMIN_PASSWORD || given.length !== want.length || !timingSafeEqual(given, want)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

const embedCode = (bot) => `<script src="${PUBLIC_URL}/widget.js" data-bot="${bot.id}" defer></script>`;
const withLinks = (bot) => ({
  ...bot,
  embed_code: embedCode(bot),
  demo_url: `${PUBLIC_URL}/demo/${bot.id}`,
  portal_url: `${PUBLIC_URL}/portal/${bot.portal_token}`,
});

const csv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
const LEAD_COLS = ['created_at', 'name', 'email', 'phone', 'need', 'urgency', 'page_url'];

async function notifyWebhook(bot, lead) {
  if (!bot.webhook_url) return;
  try {
    await fetch(bot.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'lead.created', business: bot.business_name, bot_id: bot.id, lead }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) { console.error(`webhook failed for ${bot.id}:`, e.message); }
}

// ---------- public widget API ----------
app.use('/api/widget', cors);

app.get('/api/widget/:botId', (req, res) => {
  const bot = bots.get(req.params.botId);
  if (!bot || !bot.active) return res.status(404).json({ error: 'not found' });
  res.json({
    name: bot.business_name,
    color: bot.color,
    greeting: bot.greeting || `Hi! 👋 I'm the ${bot.business_name} assistant. How can I help you today?`,
    branding: bot.plan === 'starter',
  });
});

app.post('/api/widget/:botId/chat', async (req, res) => {
  const bot = bots.get(req.params.botId);
  if (!bot || !bot.active) return res.status(404).json({ error: 'not found' });
  if (!rateLimit(`ip:${req.ip}`, 40, 10 * 60_000)) return res.status(429).json({ error: 'Too many messages — please wait a few minutes.' });

  const u = usage.get(bot.id);
  if (u.messages >= bot.monthly_limit) {
    return res.json({ reply: `Thanks for reaching out! Please contact ${bot.business_name} directly${bot.phone ? ` at ${bot.phone}` : ''} and the team will help you.` });
  }

  const raw = Array.isArray(req.body?.messages) ? req.body.messages.slice(-20) : [];
  const history = raw
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length || history.at(-1).role !== 'user') return res.status(400).json({ error: 'last message must be from user' });

  try {
    const { reply, leads: captured } = await chat(bot, history);
    usage.track(bot.id, history.filter((m) => m.role === 'user').length === 1);
    for (const l of captured) {
      const saved = leads.add(bot.id, l, req.body?.page_url);
      notifyWebhook(bot, saved);
    }
    res.json({ reply, lead_captured: captured.length > 0 });
  } catch (e) {
    console.error('chat error:', e.status ?? '', e.message);
    res.status(502).json({ reply: `Sorry, I'm having trouble right now.${bot.phone ? ` You can reach us at ${bot.phone}.` : ' Please try again shortly.'}` });
  }
});

// ---------- your agency's own sales inquiries ----------
app.post('/api/inquiry', (req, res) => {
  if (!rateLimit(`inq:${req.ip}`, 5, 60 * 60_000)) return res.status(429).json({ error: 'Too many requests' });
  if (!req.body?.email || !req.body?.name) return res.status(400).json({ error: 'name and email are required' });
  inquiries.add(req.body);
  res.json({ ok: true });
});

// ---------- client portal (read-only, secret link per business) ----------
app.get('/api/portal/:token', (req, res) => {
  const bot = bots.byPortal(req.params.token);
  if (!bot) return res.status(404).json({ error: 'not found' });
  res.json({ business_name: bot.business_name, color: bot.color, plan: bot.plan, usage: usage.get(bot.id), monthly_limit: bot.monthly_limit, leads: leads.forBot(bot.id) });
});
app.get('/api/portal/:token/leads.csv', (req, res) => {
  const bot = bots.byPortal(req.params.token);
  if (!bot) return res.sendStatus(404);
  res.type('text/csv').attachment(`${bot.business_name}-leads.csv`).send(csv(leads.forBot(bot.id), LEAD_COLS));
});

// ---------- admin API (you, the operator) ----------
const admin = express.Router();
admin.use(requireAdmin);
admin.get('/stats', (req, res) => res.json({ ...stats(), plans: PLANS }));
admin.get('/bots', (req, res) => res.json(bots.list().map(withLinks)));
admin.post('/bots', (req, res) => {
  try { res.status(201).json(withLinks(bots.create(req.body || {}))); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
admin.put('/bots/:id', (req, res) => {
  if (!bots.get(req.params.id)) return res.sendStatus(404);
  res.json(withLinks(bots.update(req.params.id, req.body || {})));
});
admin.delete('/bots/:id', (req, res) => { bots.remove(req.params.id); res.json({ ok: true }); });
admin.get('/bots/:id/leads', (req, res) => res.json(leads.forBot(req.params.id)));
admin.get('/leads', (req, res) => res.json(leads.recent(100)));
admin.get('/inquiries', (req, res) => res.json(inquiries.list()));
app.use('/api/admin', admin);

// ---------- pages ----------
app.get('/config.js', (req, res) => {
  res.type('application/javascript').send(`window.LEADPILOT = ${JSON.stringify({
    brand: process.env.BRAND_NAME || 'LeadPilot AI',
    houseBot: process.env.HOUSE_BOT_ID || '',
    calendly: process.env.SALES_BOOKING_URL || '',
    paymentLinks: { starter: process.env.STRIPE_LINK_STARTER || '', growth: process.env.STRIPE_LINK_GROWTH || '', pro: process.env.STRIPE_LINK_PRO || '' },
  })};`);
});
app.get('/admin', (req, res) => res.sendFile(path.join(pub, 'admin.html')));
app.get('/demo/:botId', (req, res) => res.sendFile(path.join(pub, 'demo.html')));
app.get('/portal/:token', (req, res) => res.sendFile(path.join(pub, 'portal.html')));
app.use(express.static(pub, { extensions: ['html'] }));

app.listen(PORT, () => console.log(`LeadPilot running on ${PUBLIC_URL}  (admin: ${PUBLIC_URL}/admin)`));
