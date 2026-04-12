import { kv } from '@vercel/kv';
import { verifyInitData } from './_verify.js';

// Theoretical max: 5 cols × 8 rows, each cell 32768, chain bonuses ~3x → ~4M
// Allow generous headroom, reject obvious cheats

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'GET') {
    try {
      const leaderboard = await kv.get('leaderboard') || [];
      return res.status(200).json({
        success: true,
        players: leaderboard
      });
    } catch (err) {
      console.error('Leaderboard GET error:', err);
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  if (req.method === 'POST') {
    try {
      let { userId, score, name, username } = req.body;

      if (!userId || score === undefined) {
        return res.status(400).json({ error: 'Missing userId or score' });
      }

      // Verify Telegram identity
      const verification = verifyInitData(req.body.initData);
      if (!verification.ok) {
        return res.status(403).json({ error: 'Unauthorized: ' + verification.error });
      }

      userId = String(userId);
      score = Number(score);

      // Reject obviously fake scores
      if (!Number.isFinite(score) || score < 0) {
        return res.status(400).json({ error: 'Invalid score' });
      }

      // userId from Telegram token must match submitted userId
      if (verification.userId !== userId) {
        return res.status(403).json({ error: 'User mismatch' });
      }

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
        bestScore: player ? Number(player.score) : score,
        players: leaderboard
      });
    } catch (err) {
      console.error('Leaderboard POST error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
