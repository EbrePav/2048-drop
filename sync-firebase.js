const FIREBASE_DB_URL = 'https://drop-beda0-default-rtdb.europe-west1.firebasedatabase.app';

async function syncWithServer() {
  if (!authToken) return false;
  try {
    const userId = authToken.replace('user-', '');
    const res = await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`);
    const data = await res.json();
    if (data) {
      allTimeBest = data.best_score || 0;
      gems = data.gems || 100;
      updateHUD();
      return true;
    } else {
      const newUser = { gems: 100, best_score: 0 };
      await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
      gems = 100; allTimeBest = 0;
      updateHUD();
      return true;
    }
  } catch (err) { console.error('Sync error:', err); return false; }
}

function startAutoSave() {
  setInterval(async () => {
    if (!authToken || gameOver || paused) return;
    try {
      const userId = authToken.replace('user-', '');
      await fetch(`${FIREBASE_DB_URL}/users/${userId}/session.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grid, falling, throws: throwsCount, score }) });
    } catch (err) { console.error('Save error:', err); }
  }, 15000);
}

async function endGameSession() {
  if (!authToken) return;
  try {
    const userId = authToken.replace('user-', '');
    const res = await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`);
    const userData = await res.json() || { gems: 100, best_score: 0 };
    const newBest = Math.max(userData.best_score || 0, score);
    userData.best_score = newBest;
    await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData) });
    allTimeBest = newBest;
    updateHUD();
  } catch (err) { console.error('End session error:', err); }
}

async function refreshDailyRewardInfo() {
  if (!authToken) return;
  try {
    const userId = authToken.replace('user-', '');
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${FIREBASE_DB_URL}/dailyRewards/${userId}/${today}.json`);
    const claimed = await res.json();
    const btn = document.getElementById('daily-claim-btn');
    if (btn) btn.style.display = claimed ? 'none' : 'block';
    if (!claimed) {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const secs = Math.floor((tomorrow - now) / 1000);
      startDailyTimer(secs);
    }
  } catch (err) { console.error('Daily error:', err); }
}

async function claimDailyReward(watchX2 = false) {
  if (!authToken) return false;
  try {
    const userId = authToken.replace('user-', '');
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${FIREBASE_DB_URL}/dailyRewards/${userId}/${today}.json`);
    const claimed = await res.json();
    if (claimed) return false;
    const res2 = await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`);
    const userData = await res2.json() || { gems: 0, best_score: 0 };
    const amount = watchX2 ? 50 : 25;
    userData.gems = (userData.gems || 0) + amount;
    await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData) });
    await fetch(`${FIREBASE_DB_URL}/dailyRewards/${userId}/${today}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(true) });
    gems = userData.gems;
    updateHUD();
    refreshDailyRewardInfo();
    return true;
  } catch (err) { console.error('Claim error:', err); return false; }
}

function startDailyTimer(secs) {
  const el = document.getElementById('daily-timer');
  if (!el) return;
  let r = Math.max(0, Math.floor(secs));
  const upd = () => {
    const h = Math.floor(r / 3600);
    const m = Math.floor((r % 3600) / 60);
    const s = r % 60;
    el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (r > 0) { r--; setTimeout(upd, 1000); }
  };
  upd();
}

function updateHUD() {
  const b = document.getElementById('best-val');
  if (b) b.textContent = formatNum(allTimeBest);
  const g = document.getElementById('gems-val');
  if (g) g.textContent = formatNum(gems);
}
