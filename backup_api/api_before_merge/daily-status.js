import { kv } from '@vercel/kv';

const DAILY_REWARDS = [5, 8, 12, 16, 20, 25, 35];

function getUtcDayKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

function getYesterdayUtcDayKey(date = new Date()) {
  const prev = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - 1,
    0, 0, 0, 0
  ));
  return getUtcDayKey(prev);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    userId = String(userId);

    const key = `daily:${userId}`;
    const state = (await kv.get(key)) || {};

    const now = new Date();
    const today = getUtcDayKey(now);
    const yesterday = getYesterdayUtcDayKey(now);
    const nextResetUtc = getNextResetIso(now);
    const secondsUntilReset = Math.max(
      0,
      Math.floor((new Date(nextResetUtc).getTime() - now.getTime()) / 1000)
    );

    let streakIndex = Number.isInteger(state.streakIndex) ? state.streakIndex : 0;
    const lastClaimDay = state.lastClaimDay || '';

    if (!lastClaimDay) {
      streakIndex = 0;
    } else if (lastClaimDay === today) {
      streakIndex = Number.isInteger(state.streakIndex) ? state.streakIndex : 0;
    } else if (lastClaimDay === yesterday) {
      streakIndex = (Number.isInteger(state.streakIndex) ? state.streakIndex : 0) + 1;
      if (streakIndex >= DAILY_REWARDS.length) streakIndex = 0;
    } else {
      streakIndex = 0;
    }

    const canClaim = lastClaimDay !== today;
    const currentDay = streakIndex + 1;
    const reward = DAILY_REWARDS[streakIndex] || DAILY_REWARDS[0];

    return res.status(200).json({
      success: true,
      canClaim,
      streakIndex,
      currentDay,
      reward,
      todayUtc: today,
      lastClaimDay,
      nextResetUtc,
      secondsUntilReset,
      rewards: DAILY_REWARDS
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
