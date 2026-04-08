async function loadBestScoreFromServer() {
  if (!TG_USER || !TG_USER.id) return;
  
  try {
    const response = await fetch(`/api/get-best-score?userId=${TG_USER.id}`);
    const data = await response.json();
    
    if (data.success && data.bestScore > 0) {
      allTimeBest = data.bestScore;
      console.log('✅ Loaded best score from server:', allTimeBest);
    }
  } catch (err) {
    console.error('Load best score error:', err);
  }
}

async function syncScoreToLeaderboard() {
  if (!TG_USER || !TG_USER.id) return;
  
  try {
    const userId = TG_USER.id;
    const username = TG_USER.first_name || `User${userId}`;
    
    const response = await fetch('/api/save-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, score: allTimeBest, username })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('✅ Score saved to leaderboard:', allTimeBest);
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
      console.log('✅ Leaderboard loaded');
      return data.leaderboard;
    }
  } catch (err) {
    console.error('Load leaderboard error:', err);
  }
  return [];
}

function syncWithServer() {
  loadBestScoreFromServer();
  loadLeaderboard();
  return true;
}

function startAutoSave() {
  setInterval(() => {
    syncScoreToLeaderboard();
  }, 30000);
}

async function endGameSession() {
  // Обновляем best_score если новый score выше
  if (score > allTimeBest) {
    allTimeBest = score;
  }
  syncScoreToLeaderboard();
  updateHUD();
  console.log('✅ Game ended, best score:', allTimeBest);
}

function updateHUD() {
  const bestVal = document.getElementById('best-val');
  if (bestVal) bestVal.textContent = formatNum(allTimeBest);
  const gemsVal = document.getElementById('gems-val');
  if (gemsVal) gemsVal.textContent = formatNum(gems);
}

async function refreshDailyRewardInfo() {}
async function claimDailyReward() { return false; }
