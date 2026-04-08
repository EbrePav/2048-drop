import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }
      
      const leaderboard = await kv.get('leaderboard') || [];
      const userScore = leaderboard.find(p => p.userId === parseInt(userId));
      
      return res.status(200).json({ 
        success: true, 
        bestScore: userScore ? userScore.score : 0,
        username: userScore ? userScore.username : null
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
