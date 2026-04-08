// ============================================
// Синхронизация состояния игры с бэком
// ============================================

const API_BASE_URL = 'https://2048-backend-production-d63b.up.railway.app';
let authToken = localStorage.getItem('authToken') || '';
let serverTime = null;
let autoSaveTimer = null;

// ============ ЗАГРУЗИТЬ СОСТОЯНИЕ ============

async function syncWithServer() {
  if (!authToken) {
    console.warn('No auth token');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/game/load-state`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!data.user) {
      console.error('Failed to load state:', data.error);
      return false;
    }

    // Синхронизируем данные
    gems = data.user.gems;
    allTimeBest = data.user.best_score;
    serverTime = new Date(data.server_time);

    // Загружаем сохраненное состояние игры
    if (data.game_session) {
      grid = data.game_session.grid;
      throws = data.game_session.throws;
      score = data.game_session.score;
    }

    // Инициализируем дневную награду
    if (data.daily_reward) {
      initDailyReward(data.daily_reward);
    }

    console.log('✅ Synced with server');
    updateHUD();
    return true;
  } catch (error) {
    console.error('Sync error:', error);
    return false;
  }
}

// ============ АВТОСЕЙВ ============

function startAutoSave() {
  if (autoSaveTimer) clearInterval(autoSaveTimer);

  autoSaveTimer = setInterval(async () => {
    if (!started || gameOver || paused) return;

    try {
      await fetch(`${API_BASE_URL}/api/game/save-state`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grid, falling, throws, score, gems,
          client_timestamp: Math.floor(Date.now() / 1000)
        })
      });
      console.log('💾 Auto-saved');
    } catch (e) {
      console.error('Autosave error:', e);
    }
  }, 30000); // каждые 30 сек
}

// ============ КОНЕЦ ИГРЫ ============

async function endGameSession() {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/game/end-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        final_score: score,
        gems_earned: gemsThisTurn || 0,
        duration_seconds: Math.floor((Date.now() - gameStartTime) / 1000)
      })
    });

    const data = await response.json();

    if (data.success) {
      gems = data.total_gems;
      allTimeBest = data.new_best_score;
      if (data.best_score_updated) {
        showToast('🏆 New best score!');
      }
      console.log('Game session ended');
      updateHUD();
    }
  } catch (error) {
    console.error('End session error:', error);
  }
}

// ============ ДНЕВНЫЕ НАГРАДЫ ============

function initDailyReward(dailyData) {
  window.dailyRewardData = dailyData;

  if (dailyData.can_claim) {
    const card = document.getElementById('daily-bonus-card');
    if (card) card.style.opacity = '1';
  }

  startDailyTimer(dailyData.time_until_next);
}

function startDailyTimer(secondsUntilNext) {
  let remaining = secondsUntilNext;

  const updateTimer = () => {
    remaining--;
    if (remaining <= 0) {
      refreshDailyRewardInfo();
      return;
    }

    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;

    const timerEl = document.querySelector('[data-daily-timer]');
    if (timerEl) {
      timerEl.textContent = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
  };

  updateTimer();
  setInterval(updateTimer, 1000);
}

async function refreshDailyRewardInfo() {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-reward/info`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    initDailyReward({
      current_day: data.current_day,
      current_reward: data.current_reward,
      can_claim: data.can_claim_today,
      time_until_next: data.time_until_reset,
      claimed_today: !data.can_claim_today,
      can_watch_x2: data.can_claim_today
    });
  } catch (error) {
    console.error('Daily info error:', error);
  }
}

async function claimDailyReward(watchX2 = false) {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-reward/claim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ with_x2: watchX2 })
    });

    const data = await response.json();

    if (data.success) {
      gems = data.total_gems;
      const txt = watchX2 ? `x2: +${data.gems_received} 💎` : `+${data.gems_received} 💎`;
      showToast(txt);
      updateHUD();
      await refreshDailyRewardInfo();
    } else {
      showToast('Already claimed today');
    }
  } catch (error) {
    console.error('Claim error:', error);
  }
}
