import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

/** Spawns the real server; resolves { base, port, stop, logs }. */
export async function startServer(extraEnv = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadpilot-test-'));
  const port = await freePort();
  const env = { ...process.env };
  for (const k of ['ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'CLAUDE_EFFORT',
    'AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL', 'AI_TOOLS', 'PUBLIC_URL']) delete env[k];
  Object.assign(env, { DATA_DIR: dataDir, PORT: String(port), ADMIN_PASSWORD: 'test123', AI_PROVIDER: 'demo' }, extraEnv);
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const logs = [];
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  let exited = false;
  child.on('exit', () => { exited = true; });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  for (;;) {
    if (exited) throw new Error(`server exited early:\n${logs.join('')}`);
    try { await fetch(`${base}/config.js`); break; } catch { /* not up yet */ }
    if (Date.now() > deadline) { child.kill(); throw new Error(`server did not start:\n${logs.join('')}`); }
    await new Promise((r) => setTimeout(r, 100));
  }
  const stop = async () => {
    if (!exited) {
      const done = new Promise((r) => child.once('exit', r));
      child.kill();
      await done;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  };
  return { base, port, stop, logs };
}

export const ADMIN = { 'x-admin-key': 'test123' };
export const jsonHeaders = (extra = {}) => ({ 'content-type': 'application/json', ...extra });
