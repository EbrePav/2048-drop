const API_BASE_URL = 'https://2048-backend-production-d63b.up.railway.app';

async function syncWithServer() {
  if (!authToken) {
    console.log('No auth token');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/game/load-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ userId: authToken })
    });

    const data = await response.json();
    if (data.success) {
      allTimeBest = data.user.best_score;
      gems = data.user.gems;
      updateHUD();
      console.log('✅ Synced with server');
      return true;
    } else {
      console.error('Failed to load state:', data.error);
      return false;
    }
  } catch (err) {
    console.error('Sync error:', err);
    return false;
  }
}

async function startAutoSave() {
  setInterval(async () => {
    if (!authToken) return;
    
    try {
      await fetch(`${API_BASE_URL}/api/game/save-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          userId: authToken,
          grid: grid,
          falling: falling,
          throws: throwsCount,
          score: score,
          gems_earned: 0
        })
      });
    } catch (err) {
      console.error('Save error:', err);
    }
  }, 30000);
}

async function endGameSession() {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/game/end-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({
        userId: authToken,
        final_score: score,
        gems_earned: 0
      })
    });

    const data = await response.json();
    if (data.success) {
      allTimeBest = data.new_best_score;
      gems = data.total_gems;
      updateHUD();
      console.log('✅ Session ended, synced with server');
    }
  } catch (err) {
    console.error('End session error:', err);
  }
}

async function refreshDailyRewardInfo() {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-reward/info`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    if (data.can_claim) {
      document.getElementById('daily-claim-btn').style.display = 'block';
    }
    startDailyTimer(data.time_until_next);
  } catch (err) {
    console.error('Daily reward error:', err);
  }
}

async function claimDailyReward(watchX2 = false) {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-reward/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ userId: authToken, with_x2: watchX2 })
    });

    const data = await response.json();
    if (data.success) {
      gems = data.total_gems;
      updateHUD();
      console.log('✅ Daily reward claimed:', data.gems_received);
      return true;
    }
  } catch (err) {
    console.error('Claim reward error:', err);
  }
  return false;
}

function startDailyTimer(secondsUntilNext) {
  const timerEl = document.getElementById('daily-timer');
  if (!timerEl) return;

  let remaining = secondsUntilNext;
  const updateTimer = () => {
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    timerEl.textContent = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    if (remaining > 0) {
      remaining--;
      setTimeout(updateTimer, 1000);
    }
  };
  
  updateTimer();
}

function updateHUD() {
  document.getElementById('best-val').textContent = formatNum(allTimeBest);
  document.getElementById('gems-val').textContent = formatNum(gems);
}
