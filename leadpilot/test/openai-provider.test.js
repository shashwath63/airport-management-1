import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer, ADMIN, jsonHeaders } from './helpers.js';

const received = [];
let mock; let mockPort; let srv;

before(async () => {
  mock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      received.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: parsed });
      const hasToolResult = parsed.messages.some((m) => m.role === 'tool');
      const message = hasToolResult
        ? { role: 'assistant', content: 'Thanks Pat, the team will call you soon!' }
        : { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: {
          name: 'capture_lead',
          arguments: JSON.stringify({ name: 'Pat Mock', phone: '415-555-0123', need: 'Wants a quote', urgency: 'this_week' }),
        } }] };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message }] }));
    });
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  mockPort = mock.address().port;
  srv = await startServer({ AI_PROVIDER: 'groq', GROQ_API_KEY: 'x', AI_BASE_URL: `http://127.0.0.1:${mockPort}` });
});
after(async () => {
  await srv?.stop();
  await new Promise((r) => (mock ? mock.close(r) : r()));
});

test('openai-compatible provider: tool call saves lead, final text is returned', async () => {
  const r0 = await fetch(`${srv.base}/api/admin/bots`, {
    method: 'POST', headers: jsonHeaders(ADMIN), body: JSON.stringify({ business_name: 'Mock Biz', knowledge: 'We fix things.' }),
  });
  const bot = await r0.json();
  const res = await fetch(`${srv.base}/api/widget/${bot.id}/chat`, {
    method: 'POST', headers: jsonHeaders(),
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi, I am Pat and my number is 415-555-0123' }] }),
  });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.reply, 'Thanks Pat, the team will call you soon!');
  assert.equal(j.lead_captured, true);

  const leads = await (await fetch(`${srv.base}/api/admin/bots/${bot.id}/leads`, { headers: ADMIN })).json();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].name, 'Pat Mock');
  assert.equal(leads[0].phone, '415-555-0123');
  assert.equal(leads[0].need, 'Wants a quote');
  assert.equal(leads[0].urgency, 'this_week');

  assert.equal(received.length, 2);
  for (const c of received) {
    assert.equal(c.method, 'POST');
    assert.equal(c.url, '/chat/completions');
    assert.equal(c.auth, 'Bearer x');
    assert.equal(c.body.messages[0].role, 'system');
    assert.match(c.body.messages[0].content, /Mock Biz/);
    assert.match(c.body.messages[0].content, /We fix things\./);
    assert.equal(c.body.messages[1].role, 'user');
    assert.equal(c.body.tools[0].function.name, 'capture_lead');
  }
  const toolMsg = received[1].body.messages.find((m) => m.role === 'tool');
  assert.equal(toolMsg.tool_call_id, 'call_1');
  assert.ok(received[1].body.messages.some((m) => m.role === 'assistant' && m.tool_calls));
});
