import { verifyInitData } from './_verify.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'https://2048-drop-nu.vercel.app';
const BOT_USERNAME = process.env.BOT_USERNAME || 'Drop2048bot';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, score, initData } = req.body;

    if (!userId || score === undefined) {
      return res.status(400).json({ error: 'Missing userId or score' });
    }

    const verification = verifyInitData(initData);
    if (!verification.ok) {
      return res.status(403).json({ error: 'Unauthorized: ' + verification.error });
    }
    if (verification.userId !== String(userId)) {
      return res.status(403).json({ error: 'User mismatch' });
    }

    const scoreFormatted = Number(score).toLocaleString('en');
    const caption =
      `🏆 Мой рекорд в 2048 Drop: <b>${scoreFormatted}</b>\n` +
      `Сможешь побить? 🎮`;

    const result = {
      type: 'photo',
      id: 'share_invite',
      photo_url: `${APP_URL}/share.jpg`,
      thumbnail_url: `${APP_URL}/share.jpg`,
      caption,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '▶️ Играть',
            url: `https://t.me/${BOT_USERNAME}`
          }
        ]]
      }
    };

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/savePreparedInlineMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Number(userId),
          result,
          allow_user_chats: true,
          allow_bot_chats: false,
          allow_group_chats: true,
          allow_channel_posts: true
        })
      }
    );

    const data = await tgRes.json();

    if (!data.ok) {
      console.error('savePreparedInlineMessage error:', data);
      return res.status(500).json({ error: data.description || 'Telegram API error' });
    }

    return res.status(200).json({
      success: true,
      id: data.result.id
    });

  } catch (err) {
    console.error('Share error:', err);
    return res.status(500).json({ error: err.message });
  }
}
