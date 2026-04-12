import { kv } from '@vercel/kv';

const DAILY_REWARDS = [5, 8, 12, 16, 20, 25, 35];

function getUtcDayKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayUtcDayKey(date = new Date()) {
  const prev = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - 1,
    0, 0, 0, 0
  ));
  return getUtcDayKey(prev);
}

function getNextResetIso(date = new Date()) {
  const next = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return next.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { userId, multiplier } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    userId = String(userId);
    multiplier = Number(multiplier || 1);

    if (![1, 2].includes(multiplier)) {
      return res.status(400).json({ error: 'Invalid multiplier' });
    }

    const dailyKey = `daily:${userId}`;
    const gemsKey = `gems:${userId}`;

    const state = (await kv.get(dailyKey)) || {};
    const now = new Date();
    const today = getUtcDayKey(now);
    const yesterday = getYesterdayUtcDayKey(now);
    const nextResetUtc = getNextResetIso(now);

    const lastClaimDay = state.lastClaimDay || '';
    if (lastClaimDay === today) {
      return res.status(400).json({
        success: false,
        error: 'Already claimed today',
        nextResetUtc
      });
    }

    let streakIndex = Number.isInteger(state.streakIndex) ? state.streakIndex : 0;

    if (!lastClaimDay) {
      streakIndex = 0;
    } else if (lastClaimDay === yesterday) {
      streakIndex = streakIndex + 1;
      if (streakIndex >= DAILY_REWARDS.length) streakIndex = 0;
    } else {
      streakIndex = 0;
    }

    const baseReward = DAILY_REWARDS[streakIndex] || DAILY_REWARDS[0];
    const finalReward = baseReward * multiplier;

    const currentGems = Number((await kv.get(gemsKey)) || 0);
    const nextGems = currentGems + finalReward;

    await kv.set(gemsKey, nextGems);
    await kv.set(dailyKey, {
      streakIndex,
      lastClaimDay: today,
      lastClaimAmount: finalReward,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      reward: finalReward,
      baseReward,
      multiplier,
      gems: nextGems,
      streakIndex,
      currentDay: streakIndex + 1,
      lastClaimDay: today,
      nextResetUtc
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
