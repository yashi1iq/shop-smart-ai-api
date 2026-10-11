const LANGS = { en: 'English', te: 'Telugu', hi: 'Hindi' };

const SYSTEM = `You are Riya, a shopping assistant at ShopSmart helping Indian shoppers pick the right product.
Talk like a knowledgeable friend who is good with gadgets and prices: warm, plain, to the point. Short paragraphs, no headings, no bullet-point walls, no stock phrases like "I'd be happy to help" or "As an assistant".
Use only the live results provided plus general product knowledge. You have not tested any product yourself, so never claim hands-on experience; say so if asked.
Never invent prices, specs, offers or stock. If something isn't in the data, say you're not sure.
Give a clear pick first, then the trade-offs in a sentence or two. No sponsored content.
If someone sincerely asks whether you are a person or a program, answer honestly: you're ShopSmart's virtual shopping assistant, not a human.`;

export async function askRiya({ message, products = [], history = [], lang = 'en' }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const ctx = products.slice(0, 8)
    .map((p) => `- ${p.title} | ₹${p.price} | ${p.store} | rating ${p.rating ?? 'n/a'} (${p.reviews ?? 0} reviews)`)
    .join('\n');
  const prior = history.slice(-10)
    .map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content).slice(0, 2000) }));
  while (prior.length && prior[0].role !== 'user') prior.shift();

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(40000),
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.RIYA_MODEL || 'claude-sonnet-5-5',
      max_tokens: 600,
      system: `${SYSTEM}\nReply in ${LANGS[lang] || 'English'}.`,
      messages: [...prior, { role: 'user', content: `${ctx ? `Live results:\n${ctx}\n\n` : ''}${message}` }]
    })
  });
  if (!res.ok) throw new Error(`Riya upstream error ${res.status}`);
  const j = await res.json();
  return j.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}
