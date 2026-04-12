import crypto from 'crypto';

/**
 * Verifies Telegram WebApp initData using HMAC-SHA256.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns { ok: true, userId } on success, or { ok: false, error } on failure.
 */
export function verifyInitData(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: 'Server misconfigured' };
  if (!initData || typeof initData !== 'string') return { ok: false, error: 'Missing initData' };

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { ok: false, error: 'Missing hash' };

    // Build data_check_string — all params except hash, sorted alphabetically, joined by \n
    params.delete('hash');
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    // secret_key = HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

    // Compute expected hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== hash) return { ok: false, error: 'Invalid signature' };

    // Extract userId from user param
    const userStr = params.get('user');
    const userId = userStr ? String(JSON.parse(userStr).id) : null;
    if (!userId) return { ok: false, error: 'No user in initData' };

    return { ok: true, userId };
  } catch (e) {
    return { ok: false, error: 'Verification error: ' + e.message };
  }
}
