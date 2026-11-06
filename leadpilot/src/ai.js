import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const MODEL = process.env.LEADPILOT_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.LEADPILOT_EFFORT || 'low'; // chat is latency-sensitive; raise if answers feel shallow

const CAPTURE_LEAD = {
  name: 'capture_lead',
  description:
    'Save a prospective customer as a lead for the business. Call this as soon as the visitor has shared ' +
    'their name AND at least one way to contact them (email or phone). Call it again if they later add details.',
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

export function systemPrompt(bot) {
  return `You are the virtual front-desk assistant for ${bot.business_name}${bot.industry ? `, a ${bot.industry} business` : ''}.
You chat with visitors on the company website. Your tone is ${bot.tone || 'friendly and professional'}.

Your job, in order:
1. Answer the visitor's questions accurately using ONLY the business information below. If the answer is not there, say you're not sure and offer to have the team follow up — never invent prices, availability, policies or medical/legal advice.
2. Guide interested visitors toward the main goal: ${bot.goal || 'getting in touch with the team'}.${bot.booking_url ? `\n   They can book directly here: ${bot.booking_url}` : ''}${bot.phone ? `\n   Phone: ${bot.phone}` : ''}
3. Naturally collect their name and email or phone so the team can follow up, then call the capture_lead tool. Ask for one detail at a time; don't interrogate. If they decline, keep helping anyway.

Style: keep replies short (1–3 sentences, chat-sized), warm, and concrete. Plain text only, no markdown headings. Reply in the visitor's language.
Stay on topic: politely decline requests unrelated to ${bot.business_name}.

<business_information>
${bot.knowledge || '(No details provided yet. Offer to connect the visitor with the team.)'}
</business_information>`;
}

/**
 * Run one chat turn. `history` is [{role:'user'|'assistant', content:string}], ending with the visitor's new message.
 * Returns { reply, leads } where leads are tool inputs the model captured this turn.
 */
export async function chat(bot, history) {
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
        if (t.name === 'capture_lead' && t.input && typeof t.input.name === 'string') {
          captured.push(t.input);
          return { type: 'tool_result', tool_use_id: t.id, content: 'Lead saved. The team will follow up. Thank the visitor and continue helping.' };
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
