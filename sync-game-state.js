async function syncScoreToLeaderboard() {
  if (!authToken || !TG_USER) return;
  
  try {
    const userId = TG_USER.id;
    const response = await fetch('/api/save-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, score: allTimeBest })
    });
    const data = await response.json();
    if (data.success) {
      console.log('✅ Score saved to leaderboard');
    }
  } catch (err) {
    console.error('Leaderboard sync error:', err);
  }
}

async function loadLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    const data = await response.json();
    if (data.success) {
      console.log('✅ Leaderboard loaded:', data.leaderboard);
      return data.leaderboard;
    }
  } catch (err) {
    console.error('Load leaderboard error:', err);
  }
  return [];
}

function syncWithServer() {
  loadLeaderboard();
  return true;
}

function startAutoSave() {
  setInterval(() => {
    syncScoreToLeaderboard();
  }, 30000); // Every 30 sec
}

async function endGameSession() {
  syncScoreToLeaderboard();
  console.log('✅ Game ended, score synced');
}

function updateHUD() {
  const bestVal = document.getElementById('best-val');
  if (bestVal) bestVal.textContent = formatNum(allTimeBest);
  const gemsVal = document.getElementById('gems-val');
  if (gemsVal) gemsVal.textContent = formatNum(gems);
}

async function refreshDailyRewardInfo() {}
async function claimDailyReward() { return false; }
