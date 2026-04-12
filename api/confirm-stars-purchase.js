import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { purchaseToken } = req.body || {};
    if (!purchaseToken) {
      return res.status(400).json({ error: 'Missing purchaseToken' });
    }

    const purchaseKey = `purchase:${purchaseToken}`;
    const purchase = await kv.get(purchaseKey);

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    if (purchase.status === 'completed') {
      const gems = Number((await kv.get(`gems:${purchase.userId}`)) || 0);
      return res.status(200).json({
        success: true,
        gems,
        alreadyProcessed: true
      });
    }

    const gemsKey = `gems:${purchase.userId}`;
    const currentGems = Number((await kv.get(gemsKey)) || 0);
    const nextGems = currentGems + Number(purchase.gems || 0);

    await kv.set(gemsKey, nextGems);
    await kv.set(purchaseKey, {
      ...purchase,
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      gems: nextGems
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
