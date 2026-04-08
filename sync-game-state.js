const API_BASE_URL = 'https://2048-backend-production-d63b.up.railway.app';
let syncInterval = null;
let lastSync = 0;

async function syncWithServer() {
  if (!authToken) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/api/game/load-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ userId: authToken })
    });
    const data = await response.json();
    if (data.success && data.user) {
      allTimeBest = data.user.best_score || 0;
      gems = data.user.gems || 100;
      updateHUD();
      lastSync = Date.now();
      console.log('✅ Synced - gems:', gems, 'best:', allTimeBest);
      return true;
    }
  } catch (err) { console.error('Sync error:', err); }
  return false;
}

function startAutoSave() {
  syncInterval = setInterval(async () => {
    if (!authToken || gameOver || paused) return;
    
    const now = Date.now();
    if (now - lastSync < 8000) return; // Min 8 сек между синками
    
    try {
      await fetch(`${API_BASE_URL}/api/game/save-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ userId: authToken, grid, falling, throws: throwsCount, score })
      });
      lastSync = now;
    } catch (err) { console.error('Save error:', err); }
  }, 10000); // Проверяем каждые 10 сек
}

async function endGameSession() {
  if (!authToken) return;
  try {
    const response = await fetch(`${API_BASE_URL}/api/game/end-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ userId: authToken, final_score: score })
    });
    const data = await response.json();
    if (data.success) {
      allTimeBest = data.new_best_score || allTimeBest;
      gems = data.total_gems || gems;
      updateHUD();
      console.log('✅ Session ended, best:', allTimeBest);
    }
  } catch (err) { console.error('End session error:', err); }
}

async function refreshDailyRewardInfo() {
  if (!authToken) return;
  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-reward/info`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    const claimBtn = document.getElementById('daily-claim-btn');
    if (claimBtn) {
      claimBtn.style.display = (data && data.can_claim) ? 'block' : 'none';
    }
    const timerEl = document.getElementById('daily-timer');
    if (timerEl) {
      if (data && data.time_until_next > 0) {
        startDailyTimer(data.time_until_next);
      } else {
        timerEl.textContent = '00:00:00';
      }
    }
  } catch (err) { console.error('Daily reward error:', err); }
}

async function claimDailyReward(watchX2 = false) {
  if (!authToken) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-reward/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ userId: authToken, with_x2: watchX2 })
    });
    const data = await response.json();
    if (data.success) {
      gems = data.total_gems || gems;
      updateHUD();
      console.log('✅ Reward claimed:', data.gems_received);
      refreshDailyRewardInfo();
      return true;
    }
  } catch (err) { console.error('Claim reward error:', err); }
  return false;
}

function startDailyTimer(secondsUntilNext) {
  const timerEl = document.getElementById('daily-timer');
  if (!timerEl) return;
  
  let remaining = Math.max(0, Math.floor(secondsUntilNext));
  
  const updateTimer = () => {
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    timerEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    
    if (remaining > 0) {
      remaining--;
      setTimeout(updateTimer, 1000);
    }
  };
  
  updateTimer();
}

function updateHUD() {
  const bestVal = document.getElementById('best-val');
  if (bestVal) bestVal.textContent = formatNum(allTimeBest);
  const gemsVal = document.getElementById('gems-val');
  if (gemsVal) gemsVal.textContent = formatNum(gems);
}
