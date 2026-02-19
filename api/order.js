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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('ERROR: Method Not Allowed');
  }

  try {
    const ct = String(req.headers['content-type'] || '').toLowerCase();
    let message = '';

    if (ct.includes('application/x-www-form-urlencoded')) {
      const form = typeof req.body === 'string' ? parseFormUrlEncoded(req.body) : (req.body || {});
      message = buildTextFromForm(form);
    } else {
      // text/plain or anything else
      if (typeof req.body === 'string') message = req.body;
      else if (req.body && typeof req.body.text === 'string') message = req.body.text;
      else message = '';
    }

    message = String(message || '').trim();
    if (!message) {
      return res.status(400).send('ERROR: Empty body');
    }

    await sendToTelegram(message);

    return res.status(200).send('OK');
  } catch (e) {
    return res.status(500).send(`ERROR: ${String(e && e.message ? e.message : e)}`);
  }
};
