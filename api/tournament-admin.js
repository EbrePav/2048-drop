import { kv } from '@vercel/kv';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'drop2048admin';

// POST /api/tournament-admin
// Activate or deactivate a reward for a winner
// Body: { secret, action, weekKey, userId, link, note }
// action: "set_reward" | "remove_reward" | "list_rewards"

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret, action, weekKey, userId, link, note } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    if (action === 'set_reward') {
      if (!weekKey || !userId) {
        return res.status(400).json({ error: 'Missing weekKey or userId' });
      }
      const reward = {
        link: link || null,   // null = reward activated but link not set yet
        note: note || '',
        activatedAt: new Date().toISOString()
      };
      await kv.set(`reward:${weekKey}:${userId}`, reward, { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ success: true, reward });
    }

    if (action === 'remove_reward') {
      if (!weekKey || !userId) {
        return res.status(400).json({ error: 'Missing weekKey or userId' });
      }
      await kv.del(`reward:${weekKey}:${userId}`);
      return res.status(200).json({ success: true });
    }

    if (action === 'get_board') {
      if (!weekKey) return res.status(400).json({ error: 'Missing weekKey' });
      const board = (await kv.get(weekKey)) || [];
      return res.status(200).json({ success: true, board });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
