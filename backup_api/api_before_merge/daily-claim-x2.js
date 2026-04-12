import claimHandler from './daily-claim.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  req.body = {
    ...(req.body || {}),
    multiplier: 2
  };

  return claimHandler(req, res);
}
