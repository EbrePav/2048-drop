import { kv } from '@vercel/kv';
import { verifyInitData } from './_verify.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'https://2048-drop-nu.vercel.app';
const BOT_USERNAME = process.env.BOT_USERNAME || 'Drop2048bot';

// Upload share.jpg to Telegram once, cache file_id in KV
async function getSharePhotoFileId() {
  const cached = await kv.get('share_photo_file_id');
  if (cached) return cached;

  // Upload to a private channel or the bot itself isn't possible without chat_id.
  // Use a temp sendPhoto to a dummy chat — instead, use sendDocument trick:
  // send to our own bot storage by using getUpdates or just send to userId later.
  // For now: return null to fall back to photo_url
  return null;
}

// Cache file_id after user's share sends it
async function cacheFileId(fileId) {
  await kv.set('share_photo_file_id', fileId, { ex: 60 * 60 * 24 * 30 }); // 30 days
}

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
      // Try cached file_id first (most reliable for preview)
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
        // First time: upload image to Telegram by sending to the user,
        // extract file_id, cache it, then proceed
        const uploadRes = await tgApi('sendPhoto', {
          chat_id: Number(userId),
          photo: `${APP_URL}/share.jpg`,
          caption: '(uploading share image, one moment...)',
          disable_notification: true
        });

        if (uploadRes.ok) {
          // Get the largest photo size file_id
          const photos = uploadRes.result.photo;
          const fileId = photos[photos.length - 1].file_id;
          await cacheFileId(fileId);

          // Delete the temp upload message
          await tgApi('deleteMessage', {
            chat_id: Number(userId),
            message_id: uploadRes.result.message_id
          });

          result = {
            type: 'photo',
            id: 'share_invite',
            photo_file_id: fileId,
            caption,
            parse_mode: 'HTML',
            reply_markup
          };
        } else {
          // Fallback to URL if upload fails
          result = {
            type: 'photo',
            id: 'share_invite',
            photo_url: `${APP_URL}/share.jpg`,
            thumbnail_url: `${APP_URL}/share.jpg`,
            photo_width: 1152,
            photo_height: 768,
            caption,
            parse_mode: 'HTML',
            reply_markup
          };
        }
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
        console.error('savePreparedInlineMessage error:', tgRes);
        return res.status(500).json({ error: tgRes.description || 'Telegram API error' });
      }

      return res.status(200).json({ success: true, id: tgRes.result.id });
    }

    // Default: send photo directly to user
    const sendRes = await tgApi('sendPhoto', {
      chat_id: Number(userId),
      photo: `${APP_URL}/share.jpg`,
      caption,
      parse_mode: 'HTML',
      reply_markup
    });

    if (!sendRes.ok) {
      return res.status(500).json({ error: sendRes.description || 'Telegram API error' });
    }

    // Cache file_id from this send too
    if (sendRes.result && sendRes.result.photo) {
      const photos = sendRes.result.photo;
      const fileId = photos[photos.length - 1].file_id;
      await cacheFileId(fileId);
    }

    return res.status(200).json({ success: true, sent: true });

  } catch (err) {
    console.error('Share error:', err);
    return res.status(500).json({ error: err.message });
  }
}
