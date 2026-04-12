import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { userId, amount } = req.body;

    if (!userId || amount === undefined) {
      return res.status(400).json({ error: 'Missing userId or amount' });
    }

    userId = String(userId);
    amount = Number(amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const key = `gems:${userId}`;
    const current = Number((await kv.get(key)) || 0);

    if (current < amount) {
      return res.status(400).json({
        success: false,
        error: 'Not enough gems',
        gems: current
      });
    }

    const next = current - amount;
    await kv.set(key, next);

    return res.status(200).json({
      success: true,
      gems: next
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
