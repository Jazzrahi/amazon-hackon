(function () {
      'use strict';

      let userId = 'user_001';

      // ── User switcher ──
      document.querySelectorAll('.user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          userId = btn.dataset.user;
          init();
        });
      });

      function animateValue(el, target, prefix, suffix, duration) {
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
            document.getElementById('eco-bar').style.width = level.pct + '%';
          }, 300);

          // Leaderboard
          document.getElementById('lb-name').textContent = `🥉 ${user.name}`;
          document.getElementById('lb-score').textContent = `₹${user.green_credits}`;

          // Load stats
          const statsRes = await fetch('/api/sustainability-stats');
          const stats = await statsRes.json();

          animateValue(document.getElementById('imp-co2'), stats.total_co2_saved_kg, '', '', 1800);
          animateValue(document.getElementById('imp-items'), stats.items_rescued, '', '', 1200);
          animateValue(document.getElementById('imp-trees'), Math.round(stats.total_co2_saved_kg / 21), '', '', 2000);
          animateValue(document.getElementById('imp-ewaste'), stats.ewaste_prevented_kg, '', '', 1600);

          // Dynamically load transactions based on orders
          const ordersRes = await fetch(`/api/orders/${userId}`);
          const orders = await ordersRes.json();
          const txContainer = document.getElementById('transactions');
          txContainer.innerHTML = ''; // clear

          let hasTx = false;
          orders.forEach(o => {
            if (o.status === 'green_credit' || o.status === 'p2p_resale' || o.status === 'credit_accepted' || o.status === 'resale_listed') {
              hasTx = true;
              const dateStr = new Date(o.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              
              let desc = '', amount = '', icon = '', amountClass = 'transaction__amount--earn';
              if (o.status === 'green_credit' || o.status === 'credit_accepted') {
                desc = `Kept Flawed Item (Order ${o.order_id}) — Refund & Credit`;
                amount = '+ Credits 💚'; 
                icon = '🌱';
              } else if (o.status === 'p2p_resale' || o.status === 'resale_listed') {
                desc = `Listed Order ${o.order_id} on Second Life`;
                amount = '+50 💚';
                icon = '♻️';
              }
              
              const div = document.createElement('div');
              div.className = 'transaction';
              div.innerHTML = `
                <div class="transaction__icon transaction__icon--earn">${icon}</div>
                <div class="transaction__info">
                  <div class="transaction__desc">${desc}</div>
                  <div class="transaction__date">${dateStr}</div>
                </div>
                <div class="transaction__amount ${amountClass}">${amount}</div>
              `;
              txContainer.appendChild(div);
            }
          });

          // Add a default welcome bonus so it's never empty
          txContainer.insertAdjacentHTML('beforeend', `
            <div class="transaction">
              <div class="transaction__icon transaction__icon--earn">🌱</div>
              <div class="transaction__info">
                <div class="transaction__desc">Welcome Bonus — First Eco Action</div>
                <div class="transaction__date">May 20, 2026</div>
              </div>
              <div class="transaction__amount transaction__amount--earn">+₹100</div>
            </div>
          `);

        } catch (e) {
          console.error('[GreenCredits]', e);
        }
      }

      init();
    })();

function updateGlobalCartCount() {
    const cc = document.getElementById('nav-cart-count');
    if (cc) {
      const cart = JSON.parse(localStorage.getItem('cart')) || [];
      cc.textContent = cart.length;
    }
  }
  document.addEventListener('DOMContentLoaded', updateGlobalCartCount);
  // Optional: Listen for custom events if added on same page
  window.addEventListener('storage', updateGlobalCartCount);

