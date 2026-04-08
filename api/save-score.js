import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { userId, score } = req.body;
      if (!userId || score === undefined) {
        return res.status(400).json({ error: 'Missing userId or score' });
      }
      
      let leaderboard = await kv.get('leaderboard') || [];
      const index = leaderboard.findIndex(p => p.userId === userId);
      
      if (index >= 0) {
        leaderboard[index].score = Math.max(leaderboard[index].score, score);
      } else {
        leaderboard.push({ userId, score });
      }
      
      leaderboard.sort((a, b) => b.score - a.score);
      await kv.set('leaderboard', leaderboard);
      
      return res.status(200).json({ success: true, leaderboard });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
