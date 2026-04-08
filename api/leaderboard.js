import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'GET') {
    try {
      const leaderboard = await kv.get('leaderboard');
      return res.status(200).json({ 
        success: true, 
        leaderboard: leaderboard || [] 
      });
    } catch (err) {
      console.error('Leaderboard error:', err);
      return res.status(200).json({ 
        success: true, 
        leaderboard: [],
        error: err.message 
      });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
