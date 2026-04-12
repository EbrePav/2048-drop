import { kv } from '@vercel/kv';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PHOTO_URL = 'https://raw.githubusercontent.com/EbrePav/2048-drop/main/share.jpg';

async function tgApi(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// Call once: GET /api/share-warmup?userId=YOUR_TELEGRAM_ID
// Sends the share image to you, caches the file_id, deletes the message.
// After this all shares will show the photo correctly.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { userId, secret } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  // Basic protection — pass ?secret=drop2048 to call this endpoint
  if (secret !== 'drop2048') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // Check if already cached
    const existing = await kv.get('share_photo_file_id');
    if (existing) {
      return res.status(200).json({ success: true, cached: true, file_id: existing });
    }

    // Send photo to the user to get a Telegram-hosted file_id
    const sendRes = await tgApi('sendPhoto', {
      chat_id: Number(userId),
      photo: PHOTO_URL,
      caption: '✅ Share image cached! You can delete this message.',
      disable_notification: true
    });

    if (!sendRes.ok) {
      return res.status(500).json({
        success: false,
        error: sendRes.description,
        hint: 'Make sure you have sent /start to the bot first'
      });
    }

    const photos = sendRes.result.photo;
    const fileId = photos[photos.length - 1].file_id;

    await kv.set('share_photo_file_id', fileId, { ex: 60 * 60 * 24 * 365 });

    return res.status(200).json({
      success: true,
      cached: false,
      file_id: fileId,
      message: 'File ID cached successfully! All shares will now show the photo.'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
