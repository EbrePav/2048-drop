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

    const leaderboard = await kv.get('leaderboard') || [];

    const player = leaderboard.find(p => String(p.userId) === userId);

    return res.status(200).json({
      success: true,
      bestScore: player?.score || 0
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}