import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { userId, score, username } = req.body;

    if (!userId || score === undefined) {
      return res.status(400).json({ error: 'Missing userId or score' });
    }

    userId = String(userId);
    score = Number(score);

    let leaderboard = await kv.get('leaderboard') || [];

    const index = leaderboard.findIndex(p => String(p.userId) === userId);

    if (index >= 0) {
      if (score > leaderboard[index].score) {
        leaderboard[index].score = score;
        leaderboard[index].username = username || `User${userId}`;
        leaderboard[index].updatedAt = new Date().toISOString();
      }
    } else {
      leaderboard.push({
        userId,
        score,
        username: username || `User${userId}`,
        createdAt: new Date().toISOString()
      });
    }

    leaderboard.sort((a, b) => b.score - a.score);

    await kv.set('leaderboard', leaderboard);

    const player = leaderboard.find(p => String(p.userId) === userId);

    return res.status(200).json({
      success: true,
      bestScore: player?.score || score
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}