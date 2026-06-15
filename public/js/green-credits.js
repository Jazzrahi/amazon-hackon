(function () {
  'use strict';

  let userId = localStorage.getItem('active_user') || 'user_001';

  // ── User switcher ──
  document.querySelectorAll('.user-btn').forEach(btn => {
    if (btn.dataset.user === userId) btn.classList.add('active');
    else btn.classList.remove('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      userId = btn.dataset.user;
      localStorage.setItem('active_user', userId);
      init();
      if (typeof updateGlobalCartCount === 'function') updateGlobalCartCount();
    });
  });

  function animateValue(el, target, prefix, suffix, duration) {
    if (!el) return;
    const start = performance.now();
    const num = parseFloat(String(target).replace(/[^0-9.]/g, ''));
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(num * e * 10) / 10;
      el.textContent = prefix + (Number.isInteger(num) ? Math.round(v).toLocaleString('en-IN') : v.toFixed(1)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function getEcoLevel(credits) {
    if (credits >= 2000) return { name: '🏆 Eco Legend', pct: 100 };
    if (credits >= 1000) return { name: '🌳 Eco Champion', pct: 75 };
    if (credits >= 500) return { name: '🌿 Eco Grower', pct: 50 };
    if (credits >= 100) return { name: '🌱 Eco Seedling', pct: 25 };
    return { name: '🌱 Getting Started', pct: 10 };
  }

  async function init() {
    try {
      // Load user
      const userRes = await fetch(`/api/user/${userId}`);
      const user = await userRes.json();

      // Balance
      animateValue(document.getElementById('balance-amount'), user.green_credits, '₹', '', 1500);
      document.getElementById('balance-sub').textContent = `${user.name} · ${user.area}, ${user.region}`;

      // Eco level
      const level = getEcoLevel(user.green_credits);
      document.getElementById('eco-rank').textContent = level.name;
      document.getElementById('eco-current').textContent = level.name;
      setTimeout(() => {
        const bar = document.getElementById('eco-bar');
        if (bar) bar.style.width = level.pct + '%';
      }, 300);

      // Live Leaderboard
      try {
          const lbRes = await fetch('/api/leaderboard');
          const topUsers = await lbRes.json();
          const lbContainer = document.getElementById('leaderboard-container');
          if (lbContainer) {
              const medals = ['🥇', '🥈', '🥉'];
              const classes = ['leaderboard__rank--gold', 'leaderboard__rank--silver', 'leaderboard__rank--bronze'];
              
              lbContainer.innerHTML = topUsers.map((tu, idx) => {
                  const isYou = tu.id === userId;
                  const rankClass = classes[idx] || '';
                  const medalOrName = medals[idx] ? `${medals[idx]} ${tu.name.split(' ')[0]}` : tu.name.split(' ')[0];
                  
                  return `
                  <div class="leaderboard__row ${isYou ? 'leaderboard__row--you' : ''}">
                    <div class="leaderboard__rank ${rankClass}">${idx + 1}</div>
                    <div class="leaderboard__name">${medalOrName} ${isYou ? '(You)' : ''}</div>
                    <div class="leaderboard__score">₹${tu.green_credits.toLocaleString('en-IN')}</div>
                  </div>
                  `;
              }).join('');
          }
      } catch(e) {
          console.error('Failed to load leaderboard', e);
      }

      // Live Transaction History
      try {
        const txRes = await fetch(`/api/transactions/${userId}`);
        const txData = await txRes.json();
        const txContainer = document.getElementById('transactions');
        if (txContainer) {
          if (!txData.transactions || txData.transactions.length === 0) {
            txContainer.innerHTML = `<div style="padding:24px;text-align:center;color:var(--gray-400);font-size:13px;">No activity yet — start returning smart to earn credits! 🌱</div>`;
          } else {
            const typeToClass = { earn: 'earn', spend: 'spend', pending: 'earn', neutral: 'spend' };
            const amountStyle = {
              earn: 'color:var(--green-500)',
              pending: 'color:var(--orange-500)',
              spend: 'color:var(--orange-500)',
              neutral: 'color:var(--gray-400)'
            };
            txContainer.innerHTML = txData.transactions.map(tx => `
              <div class="transaction">
                <div class="transaction__icon transaction__icon--${typeToClass[tx.type] || 'earn'}">${tx.icon}</div>
                <div class="transaction__info">
                  <div class="transaction__desc">${tx.desc}</div>
                  <div class="transaction__date">${tx.date}</div>
                </div>
                <div class="transaction__amount" style="${amountStyle[tx.type] || ''};font-size:13px;font-weight:800;flex-shrink:0;">${tx.amount}</div>
              </div>
            `).join('');
          }
        }
      } catch(e) {
        console.error('Failed to load transactions', e);
      }

      // Load stats
      const statsRes = await fetch('/api/sustainability-stats');
      const stats = await statsRes.json();

      animateValue(document.getElementById('imp-co2'), stats.total_co2_saved_kg, '', '', 1800);
      animateValue(document.getElementById('imp-items'), stats.items_rescued, '', '', 1200);
      animateValue(document.getElementById('imp-trees'), Math.round(stats.total_co2_saved_kg / 21) + (stats.trees_planted || 0), '', '', 2000);
      animateValue(document.getElementById('imp-ewaste'), stats.ewaste_prevented_kg, '', '', 1600);

    } catch (e) {
      console.error('[GreenCredits]', e);
    }
  }

  function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.background = isError ? '#E53935' : '#00A86B';
    toast.style.color = '#FFFFFF';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.fontWeight = '600';
    toast.style.fontSize = '14px';
    toast.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
    toast.style.zIndex = '999999';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease-out';
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 50);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  async function plantTree() {
    try {
      const res = await fetch('/api/plant-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to plant tree', true);
        return;
      }
      showToast('🌳 ' + data.message);
      init(); // Reload stats and transactions
    } catch (e) {
      console.error(e);
      showToast('Error planting tree', true);
    }
  }

  document.getElementById('plant-tree-btn1').addEventListener('click', plantTree);
  document.getElementById('plant-tree-btn2').addEventListener('click', plantTree);

  init();
})();

function updateGlobalCartCount() {
  const cc = document.getElementById('nav-cart-count');
  if (cc) {
    const cart = JSON.parse(localStorage.getItem('cart_' + (localStorage.getItem('active_user') || 'user_001'))) || [];
    cc.textContent = cart.length;
  }
}
document.addEventListener('DOMContentLoaded', updateGlobalCartCount);
window.addEventListener('storage', updateGlobalCartCount);
