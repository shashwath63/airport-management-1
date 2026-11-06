// Provider-independent lead capture. Pulls contact details straight out of what the visitor typed,
// so leads are never lost even if a (free) model forgets to call the capture_lead tool.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?\d[\d\s().-]{6,}\d)/;
const NOT_NAMES = new Set(('looking interested wondering trying new here a an the not just calling writing hoping ' +
  'searching thinking curious available free sure ok okay fine good great happy sorry ready booking asking going ' +
  'planning from in at with based also still very really so too only').split(' '));

export const findEmail = (s) => (String(s).match(EMAIL) || [])[0] || null;
export function findPhone(s) {
  const m = String(s).replace(EMAIL, ' ').match(PHONE);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? m[0].trim() : null;
}

export function findName(s) {
  const text = String(s);
  const m = text.match(/\b(?:my name is|my name's|name is|this is|i am|i'm|im|call me)\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+)?)/i);
  if (m) {
    const words = m[1].split(/\s+/).filter((w) => !NOT_NAMES.has(w.toLowerCase()));
    if (words.length && !NOT_NAMES.has(m[1].split(/\s+/)[0].toLowerCase())) return words.map(cap).join(' ');
  }
  // "Jane Doe, 555-123-4567" / "Jane - jane@x.com"
  const lead = text.replace(EMAIL, '').replace(PHONE, '').split(/[,\n;:-]/)[0].trim();
  if (/^[A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+)?$/.test(lead) && !NOT_NAMES.has(lead.split(/\s+/)[0].toLowerCase()) && lead.length <= 30
      && (findEmail(text) || findPhone(text))) {
    return lead.split(/\s+/).map(cap).join(' ');
  }
  return null;
}
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

export function urgencyOf(s) {
  const t = String(s).toLowerCase();
  if (/\b(today|asap|urgent|emergency|right now|tonight)\b/.test(t)) return 'today';
  if (/\b(tomorrow|this week|next few days|weekend)\b/.test(t)) return 'this_week';
  if (/\b(this month|next week|soon)\b/.test(t)) return 'this_month';
  return 'just_browsing';
}

/** Returns a lead if the visitor's latest message contains contact info, else null. */
export function extractLead(history) {
  const users = history.filter((m) => m.role === 'user').map((m) => m.content);
  const latest = users.at(-1) || '';
  const email = findEmail(latest);
  const phone = findPhone(latest);
  if (!email && !phone) return null;
  let name = null;
  for (let i = users.length - 1; i >= 0 && !name; i--) name = findName(users[i]);
  const need = (users.find((u) => !findEmail(u) && !findPhone(u) && u.split(/\s+/).length >= 3) || users[0] || '').slice(0, 200);
  return { name: name || 'Website visitor', email, phone, need, urgency: urgencyOf(users.join(' ')) };
}

/** True if any earlier visitor message already contained contact info. */
export const hadContactBefore = (history) =>
  history.filter((m) => m.role === 'user').slice(0, -1).some((m) => findEmail(m.content) || findPhone(m.content));
