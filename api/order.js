function normalizeTelegram(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return s.startsWith('@') ? s : `@${s}`;
}

function buildMessage(payload) {
  const customer = payload && payload.customer ? payload.customer : {};
  const items = Array.isArray(payload && payload.items ? payload.items : []) ? payload.items : [];
  const totals = payload && payload.totals ? payload.totals : {};

  const lines = [
    'Нове замовлення з сайту «Капітан Стікер»',
    '',
    `Імʼя: ${String(customer.name || '').trim()}`,
    `Телефон: ${String(customer.phone || '').trim()}`,
    `Telegram: ${normalizeTelegram(customer.telegram)}`,
    '',
    'Товари:',
    ...items.map((it) => {
      const title = String(it && it.title ? it.title : '').trim();
      const size = String(it && it.size ? it.size : '').trim();
      const qty = Number(it && it.qty ? it.qty : 0) || 0;
      const sum = Number(it && it.sum ? it.sum : 0) || 0;
      return `- ${title}${size ? ` (${size})` : ''} x${qty} = ${sum} ₴`;
    }),
    '',
    `Підсумок: ${Number(totals.subtotal || 0) || 0} ₴`,
    totals.discount ? `Знижка: -${Number(totals.discount || 0) || 0} ₴` : '',
    `Разом: ${Number(totals.total || 0) || 0} ₴`,
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body || {};
    const customer = payload.customer || {};

    if (!String(customer.name || '').trim()) {
      return res.status(400).json({ ok: false, error: 'Missing customer.name' });
    }
    if (!String(customer.phone || '').trim()) {
      return res.status(400).json({ ok: false, error: 'Missing customer.phone' });
    }
    if (!String(customer.telegram || '').trim()) {
      return res.status(400).json({ ok: false, error: 'Missing customer.telegram' });
    }

    const message = buildMessage(payload);
    await sendToTelegram(message);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
}
