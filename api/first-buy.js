import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const userId = req.method === 'GET'
      ? req.query.userId
      : (req.body || {}).userId;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const key = `first_buy:${String(userId)}`;

    if (req.method === 'GET') {
      const used = await kv.get(key);
      return res.status(200).json({ success: true, used: !!used });
    }

    if (req.method === 'POST') {
      await kv.set(key, '1');
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
