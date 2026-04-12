import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      await kv.del('leaderboard');
      return res.status(200).json({ success: true, message: 'Leaderboard cleared' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
