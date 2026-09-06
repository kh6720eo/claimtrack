const Anthropic = require('@anthropic-ai/sdk');

const CATEGORIES = ['auto', 'property', 'liability', 'other'];
const PRIORITIES = ['low', 'medium', 'high'];

async function triageClaim({ description, amount }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system:
      'You triage insurance claims. Given a claim description and amount, respond with ONLY a JSON object ' +
      `matching {"summary": string (one sentence), "category": one of ${CATEGORIES.join('|')}, ` +
      `"priority": one of ${PRIORITIES.join('|')}}. No markdown, no extra text.`,
    messages: [{ role: 'user', content: `Description: ${description}\nAmount: $${amount}` }],
  });

  const text = message.content.find((block) => block.type === 'text')?.text ?? '{}';
  const result = JSON.parse(text);

  if (!CATEGORIES.includes(result.category) || !PRIORITIES.includes(result.priority)) {
    throw new Error('Anthropic returned an unexpected triage shape');
  }

  return result;
}

module.exports = { triageClaim };
