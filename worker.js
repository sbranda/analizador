const ALLOWED_ORIGIN = 'https://sbranda.github.io';
const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';
const MAX_TOKENS_CAP = 4096;
const MAX_BODY_BYTES = 20 * 1024 * 1024;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(obj, status, origin) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, cors(origin));
  return new Response(JSON.stringify(obj), { status: status, headers: headers });
}

async function handle(request, env) {
  const origin = request.headers.get('Origin');
  if (origin !== ALLOWED_ORIGIN) {
    return new Response('Forbidden', { status: 403 });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin);
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'Archivo demasiado grande' }, 413, origin);
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    return json({ error: 'JSON invalido' }, 400, origin);
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: 'Faltan mensajes' }, 400, origin);
  }
  const maxTokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS_CAP);
  try {
    const result = await env.AI.run(MODEL, { messages: body.messages, max_tokens: maxTokens });
    let text = result && result.response;
    if (typeof text !== 'string') {
      text = JSON.stringify(text || '');
    }
    return json({ text: text }, 200, origin);
  } catch (e) {
    const msg = String((e && e.message) || e);
    const status = /limit|quota|capacity|neuron/i.test(msg) ? 429 : 502;
    return json({ error: msg.slice(0, 300) }, status, origin);
  }
}

export default {
  fetch: handle
};
