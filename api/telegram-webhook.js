import { kv } from '@vercel/kv';

async function answerPreCheckoutQuery(botToken, preCheckoutQueryId, ok, errorMessage = '') {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      error_message: errorMessage || undefined
    })
  });
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!botToken) {
      return res.status(500).send('Missing TELEGRAM_BOT_TOKEN');
    }

    if (secret) {
      const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
      if (headerSecret !== secret) {
        return res.status(401).send('Invalid secret');
      }
    }

    const update = req.body || {};

    // 1. Pre-checkout: MUST answer within 10 seconds
    if (update.pre_checkout_query) {
      const q = update.pre_checkout_query;

      // Optional payload validation
      let payload = null;
      try {
        payload = JSON.parse(q.invoice_payload || '{}');
      } catch (_) {}

      if (!payload || !payload.purchaseToken || !payload.userId) {
        await answerPreCheckoutQuery(
          botToken,
          q.id,
          false,
          'Invalid purchase payload'
        );
        return res.status(200).json({ ok: true });
      }

      const purchase = await kv.get(`purchase:${payload.purchaseToken}`);
      if (!purchase) {
        await answerPreCheckoutQuery(
          botToken,
          q.id,
          false,
          'Purchase not found'
        );
        return res.status(200).json({ ok: true });
      }

      if (String(purchase.userId) !== String(payload.userId)) {
        await answerPreCheckoutQuery(
          botToken,
          q.id,
          false,
          'Purchase user mismatch'
        );
        return res.status(200).json({ ok: true });
      }

      await answerPreCheckoutQuery(botToken, q.id, true);
      return res.status(200).json({ ok: true });
    }

    // 2. Successful payment: grant gems exactly once
    if (update.message && update.message.successful_payment) {
      const sp = update.message.successful_payment;

      let payload = null;
      try {
        payload = JSON.parse(sp.invoice_payload || '{}');
      } catch (_) {}

      if (!payload || !payload.purchaseToken) {
        return res.status(200).json({ ok: true });
      }

      const purchaseKey = `purchase:${payload.purchaseToken}`;
      const purchase = await kv.get(purchaseKey);

      if (!purchase) {
        return res.status(200).json({ ok: true });
      }

      if (purchase.status === 'completed') {
        return res.status(200).json({ ok: true, alreadyProcessed: true });
      }

      const gemsKey = `gems:${purchase.userId}`;
      const currentGems = Number((await kv.get(gemsKey)) || 0);
      const nextGems = currentGems + Number(purchase.gems || 0);

      await kv.set(gemsKey, nextGems);
      await kv.set(purchaseKey, {
        ...purchase,
        status: 'completed',
        telegram_payment_charge_id: sp.telegram_payment_charge_id,
        provider_payment_charge_id: sp.provider_payment_charge_id || null,
        completedAt: new Date().toISOString()
      });

      return res.status(200).json({ ok: true, gems: nextGems });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).send(err.message);
  }
}
