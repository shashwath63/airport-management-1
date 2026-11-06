// Free / cheap providers that speak the OpenAI-compatible chat-completions format.
// Groq, Google Gemini, OpenRouter and local Ollama all offer free usage.
// Model names change often. If a default stops working, set AI_MODEL to one the provider currently lists.
import { systemPrompt, LEAD_TOOL } from '../prompt.js';

export const PRESETS = {
  groq: {
    label: 'Groq (free tier)',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile',
    signup: 'https://console.groq.com/keys',
  },
  gemini: {
    label: 'Google Gemini (free tier)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    model: 'gemini-2.5-flash',
    signup: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    label: 'OpenRouter (free models)',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    signup: 'https://openrouter.ai/keys',
  },
  ollama: {
    label: 'Ollama (local, free)',
    baseUrl: 'http://localhost:11434/v1',
    keyEnv: null,
    model: 'llama3.1',
    signup: 'https://ollama.com/download',
  },
  'openai-compatible': {
    label: 'Custom OpenAI-compatible endpoint',
    baseUrl: '',
    keyEnv: 'AI_API_KEY',
    model: '',
    signup: '',
  },
};

const TOOL = {
  type: 'function',
  function: {
    name: LEAD_TOOL.name,
    description: LEAD_TOOL.description,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "Visitor's name" },
        email: { type: 'string', description: 'Email address, empty string if not given' },
        phone: { type: 'string', description: 'Phone number, empty string if not given' },
        need: { type: 'string', description: 'One-sentence summary of what they want' },
        urgency: { type: 'string', enum: ['today', 'this_week', 'this_month', 'just_browsing'] },
      },
      required: ['name', 'need'],
    },
  },
};

export function create(presetName) {
  const preset = PRESETS[presetName];
  const baseUrl = (process.env.AI_BASE_URL || preset.baseUrl).replace(/\/$/, '');
  const model = process.env.AI_MODEL || preset.model;
  const apiKey = process.env.AI_API_KEY || (preset.keyEnv ? process.env[preset.keyEnv] : '') || '';
  if (!baseUrl || !model) throw new Error(`AI_PROVIDER=${presetName} needs AI_BASE_URL and AI_MODEL`);
  // Some free models don't support tool calling; set AI_TOOLS=off and the server-side extractor captures leads instead.
  const useTools = process.env.AI_TOOLS !== 'off';

  async function complete(messages) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(presetName === 'openrouter' ? { 'X-Title': 'LeadPilot AI' } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 600,
        temperature: 0.4,
        ...(useTools ? { tools: [TOOL], tool_choice: 'auto' } : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`${presetName} ${res.status}: ${text.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function chat(bot, history) {
    const messages = [{ role: 'system', content: systemPrompt(bot) }, ...history.map((m) => ({ role: m.role, content: m.content }))];
    const captured = [];

    for (let step = 0; step < 4; step++) {
      const data = await complete(messages);
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error(`${presetName}: empty response`);

      if (msg.tool_calls?.length) {
        messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
        for (const call of msg.tool_calls) {
          let content = 'Unknown tool';
          if (call.function?.name === LEAD_TOOL.name) {
            try {
              const input = JSON.parse(call.function.arguments || '{}');
              if (typeof input.name === 'string' && input.name.trim()) {
                captured.push({ name: input.name, email: input.email || null, phone: input.phone || null, need: input.need || '', urgency: input.urgency || 'just_browsing' });
                content = LEAD_TOOL.savedMessage;
              } else content = 'Missing name; ask the visitor for it.';
            } catch { content = 'Invalid arguments.'; }
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content });
        }
        continue;
      }

      const reply = String(msg.content ?? '').trim();
      return { reply: reply || 'Thanks! How else can I help?', leads: captured };
    }
    return { reply: 'Thanks! Someone from our team will be in touch shortly.', leads: captured };
  }

  return { info: { provider: presetName, model, free: presetName !== 'openai-compatible', label: preset.label }, chat };
}
