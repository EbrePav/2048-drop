import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const leaderboard = await kv.get('leaderboard') || [];

    return res.status(200).json({
      success: true,
      players: leaderboard
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}