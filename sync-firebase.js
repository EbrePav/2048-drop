const FIREBASE_DB_URL = 'https://drop-beda0-default-rtdb.europe-west1.firebasedatabase.app';
let lastSyncTime = 0;

async function syncWithServer() {
  if (!authToken) return false;
  try {
    const userId = authToken.replace('user-', '');
    const res = await fetch(`${FIREBASE_DB_URL}/users/${userId}.json?shallow=true`);
    
    if (!res.ok && res.status === 404) {
      // Первый раз - создаём пользователя
      const newUser = { gems: 100, best_score: 0, created: new Date().toISOString() };
      await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      gems = 100;
      allTimeBest = 0;
    } else {
      const data = await res.json();
      if (data && typeof data === 'object') {
        gems = data.gems !== undefined ? data.gems : gems;
        allTimeBest = data.best_score !== undefined ? data.best_score : allTimeBest;
      }
    }
    
    updateHUD();
    lastSyncTime = Date.now();
    console.log('✅ Synced - gems:', gems, 'best:', allTimeBest);
    return true;
  } catch (err) {
    console.error('Sync error:', err);
    return false;
  }
}

function startAutoSave() {
  setInterval(async () => {
    if (!authToken || !TG_USER) return;
    
    const now = Date.now();
    if (now - lastSyncTime < 5000) return; // Min 5 sec between syncs
    
    try {
      const userId = authToken.replace('user-', '');
      const userData = { gems: gems, best_score: allTimeBest, lastUpdate: new Date().toISOString() };
      await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      lastSyncTime = now;
    } catch (err) {
      console.error('Auto-save error:', err);
    }
  }, 10000); // Check every 10 seconds
}

async function endGameSession() {
  if (!authToken) return;
  
  try {
    const userId = authToken.replace('user-', '');
    const res = await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`);
    const userData = await res.json() || {};
    
    const currentBest = userData.best_score || 0;
    const newBest = Math.max(currentBest, score);
    
    if (newBest > currentBest) {
      allTimeBest = newBest;
      await fetch(`${FIREBASE_DB_URL}/users/${userId}/best_score.json`, {
        method: 'PUT',
        body: JSON.stringify(newBest)
      });
    }
    
    updateHUD();
    console.log('✅ Game ended - best:', allTimeBest);
  } catch (err) {
    console.error('End game error:', err);
  }
}

async function refreshDailyRewardInfo() {
  if (!authToken) return;
  
  try {
    const userId = authToken.replace('user-', '');
    const today = new Date().toISOString().split('T')[0];
    
    const res = await fetch(`${FIREBASE_DB_URL}/dailyRewards/${userId}/${today}.json`);
    const claimed = res.ok ? await res.json() : false;
    
    const claimBtn = document.getElementById('daily-claim-btn');
    const claimX2Btn = document.getElementById('daily-claim-x2-btn');
    
    if (claimBtn) claimBtn.style.display = claimed ? 'none' : 'block';
    if (claimX2Btn) claimX2Btn.style.display = claimed ? 'none' : 'block';
    
    if (!claimed) {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const secondsUntil = Math.floor((tomorrow - now) / 1000);
      startDailyTimer(Math.max(0, secondsUntil));
    } else {
      const timerEl = document.getElementById('daily-timer');
      if (timerEl) timerEl.textContent = '00:00:00';
    }
  } catch (err) {
    console.error('Daily info error:', err);
  }
}

async function claimDailyReward(watchX2 = false) {
  if (!authToken) return false;
  
  try {
    const userId = authToken.replace('user-', '');
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already claimed
    const checkRes = await fetch(`${FIREBASE_DB_URL}/dailyRewards/${userId}/${today}.json`);
    if (checkRes.ok) {
      const claimed = await checkRes.json();
      if (claimed) {
        console.log('Already claimed today');
        return false;
      }
    }
    
    // Add gems
    const gemsToAdd = watchX2 ? 50 : 25;
    gems += gemsToAdd;
    
    // Save gems
    await fetch(`${FIREBASE_DB_URL}/users/${userId}/gems.json`, {
      method: 'PUT',
      body: JSON.stringify(gems)
    });
    
    // Mark as claimed
    await fetch(`${FIREBASE_DB_URL}/dailyRewards/${userId}/${today}.json`, {
      method: 'PUT',
      body: JSON.stringify(true)
    });
    
    updateHUD();
    console.log('✅ Reward claimed:', gemsToAdd);
    refreshDailyRewardInfo();
    return true;
  } catch (err) {
    console.error('Claim error:', err);
    return false;
  }
}

function startDailyTimer(secondsUntilNext) {
  const timerEl = document.getElementById('daily-timer');
  if (!timerEl) return;
  
  let remaining = Math.max(0, secondsUntilNext);
  
  const updateTimer = () => {
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
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
