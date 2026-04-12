import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { userId, score, name, username } = req.body;

    if (!userId || score === undefined) {
      return res.status(400).json({ error: 'Missing userId or score' });
    }

    userId = String(userId);
    score = Number(score);

    let leaderboard = await kv.get('leaderboard') || [];
    const index = leaderboard.findIndex(p => String(p.userId) === userId);

    const displayName =
      name ||
      username ||
      (index >= 0 ? leaderboard[index].name : null) ||
      `User${userId}`;

    if (index >= 0) {
      if (score > Number(leaderboard[index].score || 0)) {
        leaderboard[index].score = score;
        leaderboard[index].name = displayName;
        leaderboard[index].updatedAt = new Date().toISOString();
      }
    } else {
      leaderboard.push({
        userId,
        score,
        name: displayName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    leaderboard.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    await kv.set('leaderboard', leaderboard);

    const player = leaderboard.find(p => String(p.userId) === userId);

    return res.status(200).json({
      success: true,
      bestScore: player ? Number(player.score) : score
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
