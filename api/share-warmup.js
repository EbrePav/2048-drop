import { kv } from '@vercel/kv';
import { readFileSync } from 'fs';
import { join } from 'path';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Send photo as binary upload (not URL) — bypasses Telegram's URL fetching
async function sendPhotoAsFile(chatId) {
  // Read the actual file from the filesystem
  const filePath = join(process.cwd(), 'share.jpg');
  const fileBuffer = readFileSync(filePath);

  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', '✅ Share image cached!');
  form.append('disable_notification', 'true');
  form.append('photo', new Blob([fileBuffer], { type: 'image/jpeg' }), 'share.jpg');

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: form
  });
  return res.json();
}

// Call once: GET /api/share-warmup?userId=YOUR_TELEGRAM_ID&secret=drop2048
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { userId, secret } = req.query;

  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  if (secret !== 'drop2048') return res.status(403).json({ error: 'Forbidden' });

  try {
    const existing = await kv.get('share_photo_file_id');
    if (existing) {
      return res.status(200).json({ success: true, cached: true, file_id: existing });
    }

    const sendRes = await sendPhotoAsFile(Number(userId));

    if (!sendRes.ok) {
      return res.status(500).json({
        success: false,
        error: sendRes.description
      });
    }

    const photos = sendRes.result.photo;
    const fileId = photos[photos.length - 1].file_id;

    await kv.set('share_photo_file_id', fileId, { ex: 60 * 60 * 24 * 365 });

    return res.status(200).json({
      success: true,
      file_id: fileId,
      message: 'Cached! All shares will now show the photo.'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
