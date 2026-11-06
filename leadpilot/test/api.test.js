import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, ADMIN, jsonHeaders } from './helpers.js';

let srv;
let base;
before(async () => { srv = await startServer(); base = srv.base; });
after(async () => { await srv?.stop(); });

const admin = (path, method = 'GET', body) => fetch(`${base}/api/admin${path}`, {
  method, headers: body ? jsonHeaders(ADMIN) : ADMIN, body: body ? JSON.stringify(body) : undefined,
});
const createBot = async (over = {}) => {
  const r = await admin('/bots', 'POST', {
    business_name: 'Bright Smile Dental', industry: 'dental', plan: 'starter', phone: '512-555-0100',
    knowledge: 'Teeth cleaning costs $99.\nWe are open Monday to Friday 8am to 5pm.', ...over,
  });
  assert.equal(r.status, 201);
  return r.json();
};
const chat = (botId, messages, extra = {}) => fetch(`${base}/api/widget/${botId}/chat`, {
  method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ messages, ...extra }),
});

describe('admin auth', () => {
  test('missing key -> 401', async () => assert.equal((await fetch(`${base}/api/admin/bots`)).status, 401));
  test('wrong key -> 401', async () => assert.equal((await fetch(`${base}/api/admin/stats`, { headers: { 'x-admin-key': 'nope' } })).status, 401));
  test('correct key -> 200', async () => assert.equal((await admin('/stats')).status, 200));
});

describe('bots CRUD', () => {
  test('missing business_name -> 400', async () => {
    const r = await admin('/bots', 'POST', { industry: 'dental' });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /business_name/);
  });
  test('create returns links and plan defaults', async () => {
    const bot = await createBot({ plan: 'growth' });
    assert.ok(bot.id && bot.portal_token);
    assert.match(bot.embed_code, new RegExp(`data-bot="${bot.id}"`));
    assert.match(bot.embed_code, /widget\.js/);
    assert.match(bot.demo_url, new RegExp(`/demo/${bot.id}$`));
    assert.match(bot.portal_url, new RegExp(`/portal/${bot.portal_token}$`));
    assert.equal(bot.monthly_limit, 4000);
  });
  test('update plan changes monthly_limit', async () => {
    const bot = await createBot();
    assert.equal(bot.monthly_limit, 1000);
    const r = await admin(`/bots/${bot.id}`, 'PUT', { plan: 'pro' });
    assert.equal(r.status, 200);
    const upd = await r.json();
    assert.equal(upd.plan, 'pro');
    assert.equal(upd.monthly_limit, 15000);
  });
  test('update unknown bot -> 404', async () => assert.equal((await admin('/bots/nope', 'PUT', { plan: 'pro' })).status, 404));
  test('delete removes the bot', async () => {
    const bot = await createBot();
    assert.equal((await admin(`/bots/${bot.id}`, 'DELETE')).status, 200);
    const list = await (await admin('/bots')).json();
    assert.ok(!list.some((b) => b.id === bot.id));
    assert.equal((await fetch(`${base}/api/widget/${bot.id}`)).status, 404);
  });
});

describe('widget config', () => {
  test('GET /api/widget/:id works', async () => {
    const bot = await createBot({ business_name: 'Widget Biz' });
    const r = await fetch(`${base}/api/widget/${bot.id}`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.name, 'Widget Biz');
    assert.match(j.greeting, /Widget Biz/);
    assert.equal(j.branding, true);
  });
  test('404 for unknown bot', async () => assert.equal((await fetch(`${base}/api/widget/doesnotexist`)).status, 404));
  test('404 for paused bot (widget and chat)', async () => {
    const bot = await createBot();
    await admin(`/bots/${bot.id}`, 'PUT', { active: 0 });
    assert.equal((await fetch(`${base}/api/widget/${bot.id}`)).status, 404);
    assert.equal((await chat(bot.id, [{ role: 'user', content: 'hi' }])).status, 404);
  });
  test('CORS headers on GET', async () => {
    const bot = await createBot();
    const r = await fetch(`${base}/api/widget/${bot.id}`);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
  });
  test('OPTIONS preflight -> 204 with CORS headers', async () => {
    const r = await fetch(`${base}/api/widget/anything/chat`, { method: 'OPTIONS' });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
    assert.match(r.headers.get('access-control-allow-methods'), /POST/);
    assert.match(r.headers.get('access-control-allow-headers'), /Content-Type/i);
  });
});

describe('chat', () => {
  test('400 when last message is not from user', async () => {
    const bot = await createBot();
    const r = await chat(bot.id, [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }]);
    assert.equal(r.status, 400);
  });
  test('400 for empty / invalid messages', async () => {
    const bot = await createBot();
    assert.equal((await chat(bot.id, [])).status, 400);
    assert.equal((await chat(bot.id, 'nope')).status, 400);
  });
  test('answers a question without capturing a lead', async () => {
    const bot = await createBot();
    const j = await (await chat(bot.id, [{ role: 'user', content: 'How much is a cleaning?' }])).json();
    assert.match(j.reply, /\$99/);
    assert.equal(j.lead_captured, false);
  });

  test('multi-turn conversation captures lead; visible in admin, portal and CSV', async () => {
    const bot = await createBot({ business_name: 'Lead Biz' });
    const msgs = [{ role: 'user', content: 'I want to book a whitening appointment tomorrow' }];
    let j = await (await chat(bot.id, msgs)).json();
    assert.equal(j.lead_captured, false);
    msgs.push({ role: 'assistant', content: j.reply }, { role: 'user', content: "I'm Sarah Lee, 415-555-0199" });
    const r = await chat(bot.id, msgs, { page_url: 'https://example.com/pricing' });
    j = await r.json();
    assert.equal(j.lead_captured, true);
    assert.match(j.reply, /Thanks, Sarah/);

    const adminLeads = await (await admin('/leads')).json();
    const found = adminLeads.find((l) => l.bot_id === bot.id);
    assert.ok(found);
    assert.equal(found.name, 'Sarah Lee');
    assert.equal(found.phone, '415-555-0199');
    assert.equal(found.urgency, 'this_week');
    assert.equal(found.page_url, 'https://example.com/pricing');
    assert.equal(found.business_name, 'Lead Biz');
    assert.equal((await (await admin(`/bots/${bot.id}/leads`)).json()).length, 1);

    const portal = await (await fetch(`${base}/api/portal/${bot.portal_token}`)).json();
    assert.equal(portal.business_name, 'Lead Biz');
    assert.equal(portal.leads.length, 1);
    assert.equal(portal.leads[0].name, 'Sarah Lee');
    assert.equal(portal.usage.messages, 2);

    const csvRes = await fetch(`${base}/api/portal/${bot.portal_token}/leads.csv`);
    assert.equal(csvRes.status, 200);
    assert.match(csvRes.headers.get('content-type'), /text\/csv/);
    const lines = (await csvRes.text()).split('\n');
    assert.equal(lines[0], 'created_at,name,email,phone,need,urgency,page_url');
    assert.equal(lines.length, 2);
    assert.match(lines[1], /"Sarah Lee"/);
    assert.match(lines[1], /"415-555-0199"/);
  });

  test('portal: unknown token -> 404 (json and csv)', async () => {
    assert.equal((await fetch(`${base}/api/portal/nope`)).status, 404);
    assert.equal((await fetch(`${base}/api/portal/nope/leads.csv`)).status, 404);
  });

  test('monthly limit: second message gets polite limit reply', async () => {
    const bot = await createBot({ phone: '512-555-0100' });
    assert.equal((await admin(`/bots/${bot.id}`, 'PUT', { monthly_limit: 1 })).status, 200);
    const first = await (await chat(bot.id, [{ role: 'user', content: 'How much is a cleaning?' }])).json();
    assert.match(first.reply, /\$99/);
    const second = await (await chat(bot.id, [{ role: 'user', content: 'How much is a cleaning?' }])).json();
    assert.match(second.reply, /Please contact .* directly at 512-555-0100/);
    assert.doesNotMatch(second.reply, /\$99/);
  });
});

describe('inquiry & stats', () => {
  test('/api/inquiry requires name and email', async () => {
    const post = (b) => fetch(`${base}/api/inquiry`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(b) });
    assert.equal((await post({ name: 'A' })).status, 400);
    assert.equal((await post({ email: 'a@b.com' })).status, 400);
    const ok = await post({ name: 'A', email: 'a@b.com', business: 'Biz' });
    assert.equal(ok.status, 200);
    const list = await (await admin('/inquiries')).json();
    assert.ok(list.some((i) => i.email === 'a@b.com' && i.business === 'Biz'));
  });

  test('stats MRR reflects active bots only', async () => {
    const before = (await (await admin('/stats')).json()).mrr;
    const g = await createBot({ plan: 'growth' }); // 197
    const p = await createBot({ plan: 'pro' });    // 397
    assert.equal((await (await admin('/stats')).json()).mrr, before + 197 + 397);
    await admin(`/bots/${p.id}`, 'PUT', { active: 0 });
    assert.equal((await (await admin('/stats')).json()).mrr, before + 197);
    const s = await (await admin('/stats')).json();
    assert.equal(s.ai.provider, 'demo');
    assert.equal(s.plans.growth.price, 197);
    await admin(`/bots/${g.id}`, 'DELETE');
    assert.equal((await (await admin('/stats')).json()).mrr, before);
  });
});
