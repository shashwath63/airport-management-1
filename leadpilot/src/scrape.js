import net from 'node:net';
import { lookup } from 'node:dns/promises';

const MAX_BYTES = 1_500_000;
const MAX_TEXT = 25000;
const LINK_HINT = /(about|services?|pricing|prices?|menu|faq|contact|hours)/i;

// ---------- URL safety ----------
function isPrivateIPv4(h) {
  const [a, b] = h.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export function isPrivateHost(hostname) {
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const kind = net.isIP(h);
  if (kind === 4) return isPrivateIPv4(h);
  if (kind === 6) {
    const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIPv4(mapped[1]);
    return h === '::' || h === '::1' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:');
  }
  return !h.includes('.'); // bare single-label hosts (e.g. "intranet")
}

/** Returns a URL object for a safe public http(s) address, or throws. */
export function safeUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new Error('url is required');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = `https://${raw}`;
  let u;
  try { u = new URL(raw); } catch { throw new Error('invalid url'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('only http and https urls are allowed');
  if (isPrivateHost(u.hostname)) throw new Error('that address is not allowed');
  u.hash = '';
  return u;
}

/** Also blocks public-looking names that resolve to private addresses (e.g. 127.0.0.1.nip.io). */
export async function assertPublicDns(u) {
  if (net.isIP(u.hostname.replace(/^\[|\]$/g, ''))) return;
  let addrs;
  try { addrs = await lookup(u.hostname, { all: true }); } catch { throw new Error('could not resolve that website'); }
  if (!addrs.length || addrs.some((a) => isPrivateHost(a.address))) throw new Error('that address is not allowed');
}

// ---------- HTML -> text ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', copy: '(c)' };

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => safeChar(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m, d) => safeChar(Number(d), m))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
function safeChar(code, fallback) {
  try { return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback; } catch { return fallback; }
}

export function htmlToText(html) {
  let s = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|br|tr|section|article|header|table|dl|dt|dd|address)\b[^>]*>/gi, '\n')
    .replace(/<\/t[dh]\s*>/gi, ' | ')
    .replace(/<[^>]*>/g, ' ');
  s = decodeEntities(s);
  const seen = new Set();
  const lines = [];
  for (const line of s.split(/\r?\n/)) {
    const t = line.replace(/\s+/g, ' ').replace(/(\s\|)+\s*$/, '').trim();
    if (t.length < 3 || seen.has(t)) continue;
    seen.add(t);
    lines.push(t);
  }
  return lines.join('\n');
}

/** Same-origin links whose path or text looks like a useful info page. */
export function findInfoLinks(html, baseUrl, max = 4) {
  const base = new URL(baseUrl);
  const found = new Map();
  for (const m of String(html).matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u;
    try { u = new URL(decodeEntities(m[1]), base); } catch { continue; }
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.origin !== base.origin) continue;
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4)$/i.test(u.pathname)) continue;
    u.hash = '';
    if (u.href === base.href || u.pathname === base.pathname || u.pathname === '/') continue;
    const text = m[2].replace(/<[^>]*>/g, ' ');
    if (!LINK_HINT.test(u.pathname) && !LINK_HINT.test(text)) continue;
    if (!found.has(u.href)) found.set(u.href, true);
    if (found.size >= max) break;
  }
  return [...found.keys()];
}

// ---------- fetching ----------
async function readCapped(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  reader.cancel().catch(() => {});
  return Buffer.concat(chunks).subarray(0, MAX_BYTES).toString('utf8');
}

async function fetchHtml(url) {
  let current = safeUrl(url);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicDns(current);
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadPilotBot/1.0)', Accept: 'text/html,application/xhtml+xml' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = safeUrl(new URL(res.headers.get('location'), current).href); // re-validate every hop
      continue;
    }
    if (!res.ok) throw new Error(`site responded with HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (type && !/html|text\/plain|xml/i.test(type)) throw new Error('that url is not a web page');
    return { html: await readCapped(res), url: current.href };
  }
  throw new Error('too many redirects');
}

export async function scrapeSite(url) {
  const home = await fetchHtml(url);
  const pages = [home.url];
  const parts = [htmlToText(home.html)];
  const extra = await Promise.allSettled(findInfoLinks(home.html, home.url, 4).map((l) => fetchHtml(l)));
  for (const r of extra) {
    if (r.status !== 'fulfilled') continue;
    pages.push(r.value.url);
    parts.push(htmlToText(r.value.html));
  }
  // de-duplicate lines across pages (menus, repeated blurbs)
  const seen = new Set();
  const text = parts.join('\n').split('\n').filter((l) => !seen.has(l) && seen.add(l)).join('\n').slice(0, MAX_TEXT);
  return { text, pages };
}
