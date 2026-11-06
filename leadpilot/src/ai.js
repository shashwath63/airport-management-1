// Picks the AI provider and runs one chat turn. Lead capture always has a server-side safety net.
//
// AI_PROVIDER = demo | anthropic | groq | gemini | openrouter | ollama | openai-compatible
// If AI_PROVIDER is unset it auto-detects from whichever key is present, else falls back to free demo mode.
import * as anthropic from './providers/anthropic.js';
import * as demo from './providers/demo.js';
import { create as createOpenAI, PRESETS } from './providers/openai-compatible.js';
import { extractLead } from './leadExtract.js';

function detect() {
  const p = (process.env.AI_PROVIDER || '').toLowerCase();
  if (p) return p;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  return 'demo';
}

function load(name) {
  if (name === 'anthropic' || name === 'claude') return anthropic;
  if (name === 'demo') return demo;
  if (PRESETS[name]) return createOpenAI(name);
  console.warn(`Unknown AI_PROVIDER "${name}", using demo mode.`);
  return demo;
}

const provider = load(detect());
export const aiInfo = provider.info;
export const providerOptions = Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, signup: p.signup }));

export async function chat(bot, history) {
  const result = await provider.chat(bot, history);
  // Safety net: if the model didn't record a lead but the visitor just typed contact details, save it anyway.
  if (!result.leads.length) {
    const lead = extractLead(history);
    if (lead) result.leads.push(lead);
  }
  return result;
}
