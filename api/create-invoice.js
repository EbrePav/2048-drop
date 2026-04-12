import { kv } from '@vercel/kv';
import crypto from 'crypto';

const PRODUCTS = {
  gems100_first: { title: '100 Gems', description: '100 gems for 5 Telegram Stars', amount: 5, gems: 100 },
  gems100:       { title: '100 Gems', description: '100 gems for 10 Telegram Stars', amount: 10, gems: 100 },
  gems200:       { title: '200 Gems', description: '200 gems for 18 Telegram Stars', amount: 18, gems: 200 },
  gems500:       { title: '500 Gems', description: '500 gems for 45 Telegram Stars', amount: 45, gems: 500 },
  gems1000:      { title: '1000 Gems', description: '1000 gems for 90 Telegram Stars', amount: 90, gems: 1000 }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { itemId, userId } = req.body || {};
    if (!itemId || !userId) {
      return res.status(400).json({ error: 'Missing itemId or userId' });
    }

    const product = PRODUCTS[itemId];
    if (!product) {
      return res.status(400).json({ error: 'Unknown itemId' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ error: 'Missing TELEGRAM_BOT_TOKEN env' });
    }

    const purchaseToken = crypto.randomUUID();

    await kv.set(`purchase:${purchaseToken}`, {
      userId: String(userId),
      itemId,
      gems: product.gems,
      stars: product.amount,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    const payload = {
      title: product.title,
      description: product.description,
      payload: JSON.stringify({
        purchaseToken,
        itemId,
        userId: String(userId)
      }),
      currency: 'XTR',
      prices: [
        {
          label: product.title,
          amount: product.amount
        }
      ]
    };

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(500).json({
        error: tgData.description || 'Failed to create invoice link'
      });
    }

    return res.status(200).json({
      success: true,
      invoiceUrl: tgData.result,
      purchaseToken
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
