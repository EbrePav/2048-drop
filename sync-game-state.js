// Локальная синхронизация через localStorage
function updateLocalStorage() {
  if (TG_USER && TG_USER.id) {
    const saveData = {
      gems: gems,
      best_score: allTimeBest,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(`game_${TG_USER.id}`, JSON.stringify(saveData));
  }
}

function loadFromLocalStorage() {
  if (TG_USER && TG_USER.id) {
    const saved = localStorage.getItem(`game_${TG_USER.id}`);
    if (saved) {
      const data = JSON.parse(saved);
      gems = data.gems || 100;
      allTimeBest = data.best_score || 0;
      updateHUD();
      console.log('✅ Loaded from localStorage');
    }
  }
}

function syncWithServer() {
  loadFromLocalStorage();
  return true;
}

function startAutoSave() {
  setInterval(() => {
    updateLocalStorage();
  }, 5000);
}

async function endGameSession() {
  updateLocalStorage();
  console.log('✅ Game saved');
}

function updateHUD() {
  const bestVal = document.getElementById('best-val');
  if (bestVal) bestVal.textContent = formatNum(allTimeBest);
  const gemsVal = document.getElementById('gems-val');
  if (gemsVal) gemsVal.textContent = formatNum(gems);
}

async function refreshDailyRewardInfo() {
  // Daily reward - простая реализация
}

async function claimDailyReward(watchX2 = false) {
  const amount = watchX2 ? 50 : 25;
  gems += amount;
  updateLocalStorage();
  updateHUD();
  return true;
}
