import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
