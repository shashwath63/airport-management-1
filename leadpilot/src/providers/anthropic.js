// Claude (paid, best quality). Used when ANTHROPIC_API_KEY is set or AI_PROVIDER=anthropic.
import Anthropic from '@anthropic-ai/sdk';
import { systemPrompt, LEAD_TOOL } from '../prompt.js';

let client;
const MODEL = process.env.AI_MODEL || process.env.LEADPILOT_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.LEADPILOT_EFFORT || 'low'; // chat is latency-sensitive; raise if answers feel shallow

const CAPTURE_LEAD = {
  name: LEAD_TOOL.name,
  description: LEAD_TOOL.description,
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'email', 'phone', 'need', 'urgency'],
    properties: {
      name: { type: 'string', description: "Visitor's name" },
      email: { type: ['string', 'null'], description: 'Email address, or null if not given' },
      phone: { type: ['string', 'null'], description: 'Phone number, or null if not given' },
      need: { type: 'string', description: 'One-sentence summary of what they want' },
      urgency: { type: 'string', enum: ['today', 'this_week', 'this_month', 'just_browsing'] },
    },
  },
};

export const info = { provider: 'anthropic', model: MODEL, free: false };

export async function chat(bot, history) {
  client ??= new Anthropic();
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  const captured = [];

  for (let step = 0; step < 4; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: EFFORT },
      system: [{ type: 'text', text: systemPrompt(bot), cache_control: { type: 'ephemeral' } }],
      tools: [CAPTURE_LEAD],
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return { reply: "Sorry, I can't help with that here. Is there anything about our services I can help with?", leads: captured };
    }

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason === 'tool_use' && toolUses.length) {
      messages.push({ role: 'assistant', content: response.content });
      const results = toolUses.map((t) => {
        if (t.name === LEAD_TOOL.name && t.input && typeof t.input.name === 'string') {
          captured.push(t.input);
          return { type: 'tool_result', tool_use_id: t.id, content: LEAD_TOOL.savedMessage };
        }
        return { type: 'tool_result', tool_use_id: t.id, content: 'Unknown tool', is_error: true };
      });
      messages.push({ role: 'user', content: results });
      continue;
    }

    const reply = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return { reply: reply || 'Thanks! How else can I help?', leads: captured };
  }
  return { reply: 'Thanks! Someone from our team will be in touch shortly.', leads: captured };
}
