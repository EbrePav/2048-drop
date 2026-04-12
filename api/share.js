import { kv } from '@vercel/kv';
import { verifyInitData } from './_verify.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || 'Drop2048bot';

const PHOTO_URL = 'https://raw.githubusercontent.com/EbrePav/2048-drop/main/share.jpg';

async function tgApi(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, score, initData, mode } = req.body;

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

    const reply_markup = {
      inline_keyboard: [[
        { text: '▶️ Играть', url: `https://t.me/${BOT_USERNAME}` }
      ]]
    };

    if (mode === 'prepared') {
      // Try cached Telegram file_id first (most reliable)
      const cachedFileId = await kv.get('share_photo_file_id');

      let result;
      if (cachedFileId) {
        result = {
          type: 'photo',
          id: 'share_invite',
          photo_file_id: cachedFileId,
          caption,
          parse_mode: 'HTML',
          reply_markup
        };
      } else {
        // Use GitHub raw URL — publicly accessible by Telegram
        result = {
          type: 'photo',
          id: 'share_invite',
          photo_url: PHOTO_URL,
          thumbnail_url: PHOTO_URL,
          photo_width: 1152,
          photo_height: 768,
          caption,
          parse_mode: 'HTML',
          reply_markup
        };
      }

      const tgRes = await tgApi('savePreparedInlineMessage', {
        user_id: Number(userId),
        result,
        allow_user_chats: true,
        allow_bot_chats: false,
        allow_group_chats: true,
        allow_channel_posts: true
      });

      if (!tgRes.ok) {
        console.error('savePreparedInlineMessage error:', JSON.stringify(tgRes));
        return res.status(500).json({ error: tgRes.description || 'Telegram API error' });
      }

      return res.status(200).json({ success: true, id: tgRes.result.id });
    }

    // Default: send photo directly to user
    const sendRes = await tgApi('sendPhoto', {
      chat_id: Number(userId),
      photo: PHOTO_URL,
      caption,
      parse_mode: 'HTML',
      reply_markup
    });

    if (!sendRes.ok) {
      return res.status(500).json({ error: sendRes.description || 'Telegram API error' });
    }

    // Cache file_id
    if (sendRes.result && sendRes.result.photo) {
      const fileId = sendRes.result.photo[sendRes.result.photo.length - 1].file_id;
      await kv.set('share_photo_file_id', fileId, { ex: 60 * 60 * 24 * 30 });
    }

    return res.status(200).json({ success: true, sent: true });

  } catch (err) {
    console.error('Share error:', err);
    return res.status(500).json({ error: err.message });
  }
}
