import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const dataDir = process.env.DATA_DIR || path.resolve('data');
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'leadpilot.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    industry TEXT DEFAULT '',
    website TEXT DEFAULT '',
    knowledge TEXT DEFAULT '',
    tone TEXT DEFAULT 'friendly and professional',
    goal TEXT DEFAULT 'book an appointment',
    booking_url TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    greeting TEXT DEFAULT '',
    color TEXT DEFAULT '#4f46e5',
    webhook_url TEXT DEFAULT '',
    plan TEXT DEFAULT 'starter',
    monthly_limit INTEGER DEFAULT 1000,
    portal_token TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    name TEXT, email TEXT, phone TEXT, need TEXT, urgency TEXT,
    page_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS usage (
    bot_id TEXT NOT NULL, month TEXT NOT NULL,
    messages INTEGER DEFAULT 0, conversations INTEGER DEFAULT 0,
    PRIMARY KEY (bot_id, month)
  );
  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT, business TEXT, website TEXT, message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT NOT NULL,
    contact_name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    website TEXT DEFAULT '',
    niche TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    bot_id TEXT,
    notes TEXT DEFAULT '',
    next_follow_up DATE,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

export const PLANS = {
  starter: { label: 'Starter', price: 97, monthly_limit: 1000 },
  growth: { label: 'Growth', price: 197, monthly_limit: 4000 },
  pro: { label: 'Pro', price: 397, monthly_limit: 15000 },
};

const BOT_FIELDS = ['business_name', 'industry', 'website', 'knowledge', 'tone', 'goal',
  'booking_url', 'phone', 'greeting', 'color', 'webhook_url', 'plan', 'monthly_limit', 'active'];

const id = (n) => randomBytes(n).toString('base64url');
const month = () => new Date().toISOString().slice(0, 7);

function clean(input) {
  const out = {};
  for (const f of BOT_FIELDS) {
    if (input[f] === undefined) continue;
    if (f === 'monthly_limit' || f === 'active') out[f] = Number(input[f]) || 0;
    else out[f] = String(input[f]).slice(0, f === 'knowledge' ? 30000 : 500);
  }
  if (out.plan && !PLANS[out.plan]) out.plan = 'starter';
  if (out.plan && input.monthly_limit === undefined) out.monthly_limit = PLANS[out.plan].monthly_limit;
  if (out.color && !/^#[0-9a-fA-F]{6}$/.test(out.color)) out.color = '#4f46e5';
  return out;
}

export const bots = {
  list: () => db.prepare(`
    SELECT b.*, (SELECT COUNT(*) FROM leads l WHERE l.bot_id = b.id) AS lead_count,
           COALESCE(u.messages, 0) AS messages_this_month
    FROM bots b LEFT JOIN usage u ON u.bot_id = b.id AND u.month = ?
    ORDER BY b.created_at DESC`).all(month()),
  get: (botId) => db.prepare('SELECT * FROM bots WHERE id = ?').get(botId),
  byPortal: (token) => db.prepare('SELECT * FROM bots WHERE portal_token = ?').get(token),
  create(input) {
    const data = clean(input);
    if (!data.business_name) throw new Error('business_name is required');
    data.id = id(9);
    data.portal_token = id(18);
    const cols = Object.keys(data);
    db.prepare(`INSERT INTO bots (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((c) => data[c]));
    return bots.get(data.id);
  },
  update(botId, input) {
    const data = clean(input);
    const cols = Object.keys(data);
    if (cols.length) {
      db.prepare(`UPDATE bots SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE id = ?`)
        .run(...cols.map((c) => data[c]), botId);
    }
    return bots.get(botId);
  },
  remove(botId) {
    db.prepare('DELETE FROM leads WHERE bot_id = ?').run(botId);
    db.prepare('DELETE FROM usage WHERE bot_id = ?').run(botId);
    db.prepare('UPDATE prospects SET bot_id = NULL WHERE bot_id = ?').run(botId);
    db.prepare('DELETE FROM bots WHERE id = ?').run(botId);
  },
};

export const leads = {
  add(botId, lead, pageUrl = '') {
    const r = db.prepare(`INSERT INTO leads (bot_id, name, email, phone, need, urgency, page_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(botId, lead.name ?? '', lead.email ?? '', lead.phone ?? '',
      lead.need ?? '', lead.urgency ?? '', String(pageUrl).slice(0, 500));
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(r.lastInsertRowid);
  },
  forBot: (botId) => db.prepare('SELECT * FROM leads WHERE bot_id = ? ORDER BY id DESC').all(botId),
  recent: (limit = 50) => db.prepare(`SELECT l.*, b.business_name FROM leads l JOIN bots b ON b.id = l.bot_id
    ORDER BY l.id DESC LIMIT ?`).all(limit),
};

export const usage = {
  get: (botId) => db.prepare('SELECT * FROM usage WHERE bot_id = ? AND month = ?').get(botId, month())
    ?? { messages: 0, conversations: 0 },
  track(botId, newConversation) {
    db.prepare(`INSERT INTO usage (bot_id, month, messages, conversations) VALUES (?, ?, 1, ?)
      ON CONFLICT(bot_id, month) DO UPDATE SET messages = messages + 1,
      conversations = conversations + excluded.conversations`).run(botId, month(), newConversation ? 1 : 0);
  },
};

export const inquiries = {
  add: (i) => db.prepare('INSERT INTO inquiries (name, email, business, website, message) VALUES (?, ?, ?, ?, ?)')
    .run(...['name', 'email', 'business', 'website', 'message'].map((k) => String(i[k] ?? '').slice(0, 2000))),
  list: () => db.prepare('SELECT * FROM inquiries ORDER BY id DESC').all(),
};

export const PROSPECT_STATUSES = ['new', 'demo_sent', 'replied', 'trial', 'won', 'lost'];
const PROSPECT_TEXT = ['business_name', 'contact_name', 'email', 'phone', 'website', 'niche', 'notes'];

function cleanProspect(input) {
  const out = {};
  for (const f of PROSPECT_TEXT) {
    if (input[f] !== undefined) out[f] = String(input[f] ?? '').trim().slice(0, f === 'notes' ? 5000 : 500);
  }
  if (input.status !== undefined) {
    if (!PROSPECT_STATUSES.includes(input.status)) throw new Error('invalid status');
    out.status = input.status;
  }
  if (input.next_follow_up !== undefined) {
    const d = input.next_follow_up;
    if (d === null || d === '') out.next_follow_up = null;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d))) out.next_follow_up = d;
    else throw new Error('next_follow_up must be YYYY-MM-DD');
  }
  if (input.bot_id !== undefined) out.bot_id = input.bot_id ? String(input.bot_id).slice(0, 50) : null;
  return out;
}

export const prospects = {
  list: () => db.prepare(`SELECT * FROM prospects ORDER BY
    (next_follow_up IS NULL), next_follow_up, id DESC`).all(),
  get: (pid) => db.prepare('SELECT * FROM prospects WHERE id = ?').get(pid),
  create(input) {
    const data = cleanProspect(input);
    if (!data.business_name) throw new Error('business_name is required');
    const cols = Object.keys(data);
    const r = db.prepare(`INSERT INTO prospects (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((c) => data[c]));
    return prospects.get(r.lastInsertRowid);
  },
  update(pid, input) {
    const data = cleanProspect(input);
    if ('business_name' in data && !data.business_name) throw new Error('business_name is required');
    const cols = Object.keys(data);
    if (cols.length) {
      db.prepare(`UPDATE prospects SET ${cols.map((c) => `${c} = ?`).join(',')}, updated_at = datetime('now') WHERE id = ?`)
        .run(...cols.map((c) => data[c]), pid);
    }
    return prospects.get(pid);
  },
  remove: (pid) => db.prepare('DELETE FROM prospects WHERE id = ?').run(pid),
};

/** Usage + leads for one bot in a given YYYY-MM month. */
export function monthReport(botId, m) {
  const u = db.prepare('SELECT messages, conversations FROM usage WHERE bot_id = ? AND month = ?').get(botId, m)
    ?? { messages: 0, conversations: 0 };
  const rows = db.prepare(`SELECT * FROM leads WHERE bot_id = ? AND strftime('%Y-%m', created_at) = ? ORDER BY id`).all(botId, m);
  return { month: m, conversations: u.conversations, messages: u.messages, leads_count: rows.length, leads: rows };
}

export function stats() {
  const all = bots.list();
  const active = all.filter((b) => b.active);
  return {
    clients: all.length,
    active_clients: active.length,
    mrr: active.reduce((s, b) => s + (PLANS[b.plan]?.price ?? 0), 0),
    leads_total: db.prepare('SELECT COUNT(*) AS n FROM leads').get().n,
    leads_this_month: db.prepare("SELECT COUNT(*) AS n FROM leads WHERE created_at >= date('now','start of month')").get().n,
    messages_this_month: all.reduce((s, b) => s + b.messages_this_month, 0),
    inquiries: db.prepare('SELECT COUNT(*) AS n FROM inquiries').get().n,
    followups_due: db.prepare(`SELECT COUNT(*) AS n FROM prospects WHERE next_follow_up IS NOT NULL
      AND next_follow_up <= date('now') AND status NOT IN ('won','lost')`).get().n,
  };
}
