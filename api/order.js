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

function parseChatIds(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

async function sendToTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = parseChatIds(process.env.TELEGRAM_CHAT_ID);

  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  if (!chatIds.length) throw new Error('Missing TELEGRAM_CHAT_ID');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  const responses = await Promise.all(chatIds.map((chat_id) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, chat_id }),
  })));

  for (const resp of responses) {
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Telegram API error: ${resp.status} ${errText}`);
    }
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
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const message = String(body && body.text ? body.text : '').trim();

    if (!message) {
      return res.status(400).json({ ok: false, error: 'Empty text' });
    }

    await sendToTelegram(message);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
};
