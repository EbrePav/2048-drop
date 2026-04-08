import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { userId, score, username } = req.body;
      if (!userId || score === undefined) {
        return res.status(400).json({ error: 'Missing userId or score' });
      }
      
      let leaderboard = await kv.get('leaderboard') || [];
      const index = leaderboard.findIndex(p => p.userId === userId);
      
      if (index >= 0) {
        // Обновляем только если новый score выше
        if (score > leaderboard[index].score) {
          leaderboard[index].score = score;
          leaderboard[index].username = username || `User${userId}`;
          leaderboard[index].updatedAt = new Date().toISOString();
        }
      } else {
        // Новый игрок
        leaderboard.push({ 
          userId, 
          score, 
          username: username || `User${userId}`,
          createdAt: new Date().toISOString()
        });
      }
      
      // Сортируем по score
      leaderboard.sort((a, b) => b.score - a.score);
      await kv.set('leaderboard', leaderboard);
      
      return res.status(200).json({ success: true, leaderboard });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
