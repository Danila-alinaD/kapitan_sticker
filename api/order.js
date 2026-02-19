function parseFormUrlEncoded(body) {
  const out = {};
  const s = String(body || '');
  if (!s) return out;
  for (const part of s.split('&')) {
    if (!part) continue;
    const idx = part.indexOf('=');
    const k = idx === -1 ? part : part.slice(0, idx);
    const v = idx === -1 ? '' : part.slice(idx + 1);
    const key = decodeURIComponent(k.replace(/\+/g, ' '));
    const val = decodeURIComponent(v.replace(/\+/g, ' '));
    out[key] = val;
  }
  return out;
}

function buildTextFromForm(form) {
  const name = String(form.name || '').trim();
  const phone = String(form.phone || '').trim();
  const telegram = String(form.telegram || '').trim();
  const text = String(form.text || '').trim();

  if (text) return text;

  const lines = [
    'Нове замовлення з сайту «Капітан Стікер»',
    '',
    `Імʼя: ${name}`,
    `Телефон: ${phone}`,
    `Telegram: ${telegram}`,
  ].filter(Boolean);

  return lines.join('\n');
}

function setCors(res, req) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readRawBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function extractMessage(contentType, rawBody, parsedBody) {
  const ct = String(contentType || '').toLowerCase();

  // Prefer already-parsed body if platform provided it
  if (typeof parsedBody === 'string' && parsedBody.trim()) return parsedBody.trim();
  if (parsedBody && typeof parsedBody === 'object' && typeof parsedBody.text === 'string' && parsedBody.text.trim()) {
    return parsedBody.text.trim();
  }

  const raw = String(rawBody || '').trim();
  if (!raw) return '';

  if (ct.includes('application/x-www-form-urlencoded')) {
    const form = parseFormUrlEncoded(raw);
    return String(buildTextFromForm(form) || '').trim();
  }

  if (ct.includes('application/json')) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim();
      // fallback: stringify
      return JSON.stringify(obj);
    } catch {
      // if invalid JSON, treat as plain text
      return raw;
    }
  }

  // text/plain or unknown
  return raw;
}

async function sendToTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  if (!chatId) throw new Error('Missing TELEGRAM_CHAT_ID');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Telegram API error: ${resp.status} ${errText}`);
  }
}

module.exports = async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('ERROR: Method Not Allowed');
  }

  try {
    const rawBody = await readRawBody(req);
    const message = extractMessage(req.headers['content-type'], rawBody, req.body);
    if (!message) {
      return res.status(400).send('ERROR: Empty body');
    }

    await sendToTelegram(message);

    return res.status(200).send('OK');
  } catch (e) {
    return res.status(500).send(`ERROR: ${String(e && e.message ? e.message : e)}`);
  }
};
