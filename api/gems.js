import { kv } from '@vercel/kv';
import { verifyInitData } from './_verify.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      let { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      userId = String(userId);
      const gems = await kv.get(`gems:${userId}`);

      return res.status(200).json({
        success: true,
        gems: Number(gems || 0)
      });
    }

    if (req.method === 'POST') {
      let { userId, action, amount } = req.body;

      if (!userId || !action || amount === undefined) {
        return res.status(400).json({ error: 'Missing userId, action or amount' });
      }

      userId = String(userId);
      amount = Number(amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      const key = `gems:${userId}`;
      const current = Number((await kv.get(key)) || 0);

      if (action === 'add') {
        // add requires valid Telegram session to prevent fake gem inflation
        const initData = req.body.initData;
        const verification = verifyInitData(initData);
        if (!verification.ok) {
          return res.status(403).json({ error: 'Unauthorized: ' + verification.error });
        }
        // userId from initData must match userId in body
        if (verification.userId !== userId) {
          return res.status(403).json({ error: 'User mismatch' });
        }

        const next = current + amount;
        await kv.set(key, next);

        return res.status(200).json({
          success: true,
          gems: next
        });
      }

      if (action === 'spend') {
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
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
