import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      let { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      userId = String(userId);
      const state = await kv.get(`game_state:${userId}`);

      return res.status(200).json({
        success: true,
        state: state || null
      });
    }

    if (req.method === 'POST') {
      let { userId, action, state } = req.body;

      if (!userId || !action) {
        return res.status(400).json({ error: 'Missing userId or action' });
      }

      userId = String(userId);
      const key = `game_state:${userId}`;

      if (action === 'save') {
        if (!state || typeof state !== 'object') {
          return res.status(400).json({ error: 'Missing or invalid state' });
        }

        const payload = {
          ...state,
          updatedAt: new Date().toISOString()
        };

        await kv.set(key, payload);

        return res.status(200).json({
          success: true
        });
      }

      if (action === 'clear') {
        await kv.del(key);

        return res.status(200).json({
          success: true
        });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
