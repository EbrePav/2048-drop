import { kv } from '@vercel/kv';
import { verifyInitData } from './_verify.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'drop2048admin';


// Tournament runs Mon–Sat, Sunday = award day
// Key: tournament:YYYY-WNN (ISO week of the competition Mon-Sat)

function getWeekInfo(date = new Date()) {
  const day = date.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const isAwardDay = day === 0; // Sunday

  // For award day: show results of the just-finished week (previous 6 days)
  // For active week: show current week
  const ref = isAwardDay
    ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1)) // Saturday
    : date;

  // Get Monday of the ref week
  const refDay = ref.getUTCDay();
  const daysFromMon = refDay === 0 ? 6 : refDay - 1;
  const monday = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - daysFromMon));

  // ISO week number
  const jan4 = new Date(Date.UTC(monday.getUTCFullYear(), 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const jan4Mon = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  const weekNum = Math.round((monday - jan4Mon) / (7 * 86400000)) + 1;
  const weekKey = `tournament:${monday.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  // Next reset: next Monday 00:00 UTC
  const nextMonday = new Date(monday.getTime() + 7 * 86400000);

  // End of Saturday (submissions close): Sunday 00:00 UTC = monday + 6 days
  const submissionsClose = new Date(monday.getTime() + 6 * 86400000);

  // Seconds until Sunday (award day starts)
  const now = date.getTime();
  const secondsUntilAward = Math.max(0, Math.floor((submissionsClose.getTime() - now) / 1000));

  // Seconds until new week (Monday)
  const secondsUntilNewWeek = Math.max(0, Math.floor((nextMonday.getTime() - now) / 1000));

  return {
    weekKey,
    weekNum,
    isAwardDay,
    acceptingSubmissions: !isAwardDay,
    secondsUntilAward,       // countdown shown during active week
    secondsUntilNewWeek,     // countdown shown on award day
    mondayIso: monday.toISOString(),
    saturdayIso: new Date(monday.getTime() + 5 * 86400000).toISOString()
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const info = getWeekInfo();

  // ── GET ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { userId } = req.query;
      const board = (await kv.get(info.weekKey)) || [];

      // Check if this user has a reward waiting
      let reward = null;
      if (userId) {
        reward = (await kv.get(`reward:${info.weekKey}:${userId}`)) || null;
      }

      return res.status(200).json({
        success: true,
        ...info,
        players: board,
        reward
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    // ── ADMIN ──────────────────────────────────────────────────────────
    if (req.body.adminSecret) {
      if (req.body.adminSecret !== ADMIN_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      try {
        const { action, weekKey, userId, link, note } = req.body;

        if (action === 'set_reward') {
          if (!weekKey || !userId) return res.status(400).json({ error: 'Missing weekKey or userId' });
          const reward = { link: link || null, note: note || '', activatedAt: new Date().toISOString() };
          await kv.set(`reward:${weekKey}:${userId}`, reward, { ex: 60 * 60 * 24 * 30 });
          return res.status(200).json({ success: true, reward });
        }

        if (action === 'remove_reward') {
          if (!weekKey || !userId) return res.status(400).json({ error: 'Missing weekKey or userId' });
          await kv.del(`reward:${weekKey}:${userId}`);
          return res.status(200).json({ success: true });
        }

        if (action === 'get_board') {
          const key = weekKey || info.weekKey;
          const board = (await kv.get(key)) || [];
          return res.status(200).json({ success: true, weekKey: key, board });
        }

        if (action === 'clear_board') {
          const key = weekKey || info.weekKey;
          await kv.del(key);
          return res.status(200).json({ success: true, cleared: key });
        }

        return res.status(400).json({ error: 'Unknown action' });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    try {
      let { userId, score, name, username, initData } = req.body;

      if (!userId || score === undefined) {
        return res.status(400).json({ error: 'Missing userId or score' });
      }

      // Verify Telegram identity
      const verification = verifyInitData(initData);
      if (!verification.ok) {
        return res.status(403).json({ error: 'Unauthorized: ' + verification.error });
      }
      if (verification.userId !== String(userId)) {
        return res.status(403).json({ error: 'User mismatch' });
      }

      // No submissions on award day (Sunday)
      if (!info.acceptingSubmissions) {
        return res.status(400).json({ error: 'Tournament submissions are closed today' });
      }

      userId = String(userId);
      score = Number(score);

      if (!Number.isFinite(score) || score < 0) {
        return res.status(400).json({ error: 'Invalid score' });
      }

      let board = (await kv.get(info.weekKey)) || [];
      const idx = board.findIndex(p => String(p.userId) === userId);

      const displayName =
        name || username ||
        (idx >= 0 ? board[idx].name : null) ||
        `User${userId.slice(-4)}`;

      if (idx >= 0) {
        if (score > Number(board[idx].score || 0)) {
          board[idx].score = score;
          board[idx].name = displayName;
          board[idx].updatedAt = new Date().toISOString();
        }
      } else {
        board.push({ userId, score, name: displayName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }

      board.sort((a, b) => Number(b.score) - Number(a.score));

      // Keep top 100
      if (board.length > 100) board = board.slice(0, 100);

      // TTL: keep for 14 days after week ends
      await kv.set(info.weekKey, board, { ex: 60 * 60 * 24 * 14 });

      const player = board.find(p => String(p.userId) === userId);
      const rank = board.findIndex(p => String(p.userId) === userId) + 1;

      return res.status(200).json({
        success: true,
        rank,
        score: player ? Number(player.score) : score,
        players: board
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
