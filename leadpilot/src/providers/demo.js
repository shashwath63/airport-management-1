// Zero-cost "demo mode": no API key, no AI. Answers by matching the visitor's question against the
// business info, steers toward booking, and asks for contact details. Good enough to show prospects
// and to develop locally; switch to a real model (free Groq/Gemini key) before going live with clients.
import { findEmail, findPhone, findName, hadContactBefore } from '../leadExtract.js';

export const info = { provider: 'demo', model: 'keyword matcher (no AI)', free: true, label: 'Demo mode (no API key)' };

const STOP = new Set(('the a an and or but is are was were be do does did you your yours we our us i me my to of in on at for with ' +
  'can could would should will what when where how why which who whom this that these those it its have has had any some please ' +
  'there here about from just get got tell know want need like much many also than then them they their').split(' '));
const words = (s) => String(s).toLowerCase().match(/[a-z0-9$]+/g)?.filter((w) => w.length > 1 && !STOP.has(w)) ?? [];
const stem = (w) => w.replace(/(ing|ed|es|s)$/, '');

const SYNONYMS = {
  price: ['cost', 'price', 'fee', 'charge', 'how much', 'rate', '$', 'pricing', 'expensive', 'cheap'],
  hours: ['hour', 'open', 'close', 'time', 'when', 'weekend', 'saturday', 'sunday', 'monday'],
  location: ['where', 'address', 'located', 'location', 'parking', 'direction'],
  booking: ['book', 'appointment', 'schedule', 'reserve', 'availability', 'available', 'slot', 'consult', 'visit', 'sign up', 'join'],
  insurance: ['insurance', 'cover', 'plan', 'accept'],
};

function chunks(knowledge) {
  return String(knowledge || '')
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function expand(question) {
  const q = question.toLowerCase();
  const extra = [];
  for (const [topic, keys] of Object.entries(SYNONYMS)) if (keys.some((k) => q.includes(k))) extra.push(topic, ...keys);
  return [...words(question), ...extra.flatMap(words)].map(stem);
}

export function bestAnswers(knowledge, question, max = 2) {
  const qWords = new Set(expand(question));
  if (!qWords.size) return [];
  return chunks(knowledge)
    .map((text) => {
      const cw = words(text).map(stem);
      let score = 0;
      for (const w of new Set(cw)) if (qWords.has(w)) score += w.length > 4 ? 2 : 1;
      if (/\$\d/.test(text) && qWords.has('price')) score += 2;
      return { text, score };
    })
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((c) => c.text);
}

export async function chat(bot, history) {
  const latest = history.at(-1).content;
  const lower = latest.toLowerCase();
  const gaveContact = findEmail(latest) || findPhone(latest);
  const contactKnown = gaveContact || hadContactBefore(history);
  const userTurns = history.filter((m) => m.role === 'user').length;
  const wantsBooking = SYNONYMS.booking.some((k) => lower.includes(k));
  const cta = bot.booking_url ? ` You can book online here: ${bot.booking_url}` : bot.phone ? ` You can also call us at ${bot.phone}.` : '';

  if (gaveContact) {
    const name = findName(latest);
    return { reply: `Thanks${name ? `, ${name.split(' ')[0]}` : ''}! I've passed your details to the ${bot.business_name} team and someone will reach out shortly.${cta} Anything else I can help with?`, leads: [] };
  }
  if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening))\b/.test(lower) && latest.length < 25) {
    return { reply: `Hi there! 😊 I can answer questions about ${bot.business_name}: services, prices, hours and booking. What can I help with?`, leads: [] };
  }
  if (/\b(thanks|thank you|thx)\b/.test(lower) && latest.length < 40) {
    return { reply: `You're welcome! Anything else I can help you with?`, leads: [] };
  }

  const answers = bestAnswers(bot.knowledge, latest);
  let reply;
  if (answers.length) reply = answers.join(' ');
  else if (wantsBooking) reply = `I'd love to help you ${bot.goal || 'get booked in'}.`;
  else reply = `Good question. I don't have that detail on hand, but the team can answer it for you.`;

  if (wantsBooking && cta && !reply.includes(cta.trim())) reply += cta;
  // Ask for contact details when it helps (booking intent, unanswered question), otherwise only occasionally.
  const askedLastTurn = /best phone number or email/.test(history.at(-2)?.content || '');
  if (!contactKnown && !askedLastTurn && (wantsBooking || !answers.length || userTurns === 2 || userTurns % 4 === 0)) {
    reply += ` What's your name and the best phone number or email to reach you?`;
  }
  return { reply, leads: [] };
}
