(async function () {
  'use strict';

  // ── 1. Load real sustainability stats ──
  async function loadStats() {
    try {
      const res = await fetch('/api/sustainability-stats');
      const data = await res.json();

      // Total returns = returned orders count
      document.getElementById('stat-total-returns').textContent =
        (data.returns_processed || 0).toLocaleString('en-IN');

      // Items rescued (second life)
      const rescued = data.items_rescued || 0;
      const total = Math.max(rescued, data.returns_processed || 0);
      const savedPct = total > 0 ? Math.round((rescued / (total + rescued)) * 100) : 0;
      document.getElementById('stat-saved-pct').textContent = rescued > 0
        ? rescued + ' items'
        : '0 items';

      // CO2
      document.getElementById('stat-co2').textContent =
        (data.total_co2_saved_kg || 0).toLocaleString('en-IN') + ' kg';

      // Green credits issued
      document.getElementById('stat-credits').textContent =
        '₹' + (data.total_green_credits_issued || 0).toLocaleString('en-IN');
    } catch (e) {
      console.error('[Admin] Stats load error', e);
    }
  }

  // ── 2. Return Routing Decisions chart (real data) ──
  let routingChart;
  async function loadRoutingChart() {
    try {
      const res = await fetch('/api/admin/return-breakdown');
      const data = await res.json();

      const ctx = document.getElementById('routingChart').getContext('2d');
      const labels = ['Keep (Green Credit)', 'Second Life Resale', 'Standard Return', 'Active Orders'];
      const values = [data.keep_item, data.second_life, data.standard_return, data.active];
      const colors = ['#00A86B', '#007185', '#37475A', '#FF9900'];

      routingChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Orders',
            data: values,
            backgroundColor: colors,
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.parsed.y} order${ctx.parsed.y !== 1 ? 's' : ''}`
              }
            }
          },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { stepSize: 1 } },
            x: { grid: { display: false } }
          }
        }
      });
    } catch (e) {
      console.error('[Admin] Routing chart error', e);
      document.getElementById('routingChart').parentElement.innerHTML +=
        '<p style="color:#888;font-size:13px;margin-top:8px">No return data yet — process a return to see it here.</p>';
    }
  }

  // ── 3. Demand by Region chart (real data) ──
  let demandChart;
  async function loadDemandChart() {
    try {
      const res = await fetch('/api/admin/demand-by-region');
      const data = await res.json();

      const ctx = document.getElementById('demandChart').getContext('2d');
      demandChart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: data.labels,
          datasets: data.datasets
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } },
          scales: {
            r: {
              min: 0,
              max: 100,
              angleLines: { color: '#f0f0f0' },
              grid: { color: '#f0f0f0' },
              pointLabels: { font: { size: 13, family: 'Inter' } },
              ticks: { display: false }
            }
          }
        }
      });
    } catch (e) {
      console.error('[Admin] Demand chart error', e);
    }
  }

  // ── 4. Leaderboard (real data) ──
  async function loadLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard');
      const users = await res.json();
      const list = document.getElementById('leaderboard-list');
      if (!list) return;

      if (!users || users.length === 0) {
        list.innerHTML = '<li style="color:#888;font-size:13px;padding:8px 0">No users yet.</li>';
        return;
      }

      list.innerHTML = users.map((u, i) => `
        <li class="leader-item">
          <div class="leader-rank">${['🥇','🥈','🥉','4️⃣','5️⃣'][i] || (i+1)}</div>
          <div class="leader-info">
            <div class="leader-name">${escHtml(u.name)}</div>
            <div class="leader-region">${escHtml(u.area)}, ${escHtml(u.region)}</div>
          </div>
          <div class="leader-credits">₹${(u.green_credits || 0).toLocaleString('en-IN')}</div>
        </li>
      `).join('');
    } catch (e) {
      console.error('[Admin] Leaderboard error', e);
    }
  }

  // ── 5. Fraud flags — seed with real returned orders, then live updates ──
  async function seedFraudList() {
    try {
      const res = await fetch('/api/sustainability-stats');
      const stats = await res.json();
      const list = document.getElementById('fraud-list');

      // If there are no real fraud events yet, show a placeholder
      if (stats.returns_processed === 0) {
        list.innerHTML = `
          <li class="fraud-item fraud-item--empty">
            <div class="fraud-item__details">
              <div class="fraud-item__reason" style="color:#888">No fraud flags yet. Flags appear here in real-time when AI detects suspicious returns.</div>
            </div>
          </li>`;
      }
      // Real events arrive via socket.io fraud_alert — see below
    } catch (e) {
      console.error('[Admin] Fraud seed error', e);
    }
  }

  function addFraudAlert(user, reason, time) {
    const list = document.getElementById('fraud-list');
    // Remove placeholder if present
    const placeholder = list.querySelector('.fraud-item--empty');
    if (placeholder) placeholder.remove();

    const li = document.createElement('li');
    li.className = 'fraud-item fraud-item--new';
    let timeStr = 'just now';
    if (time) {
      const d = new Date(time);
      if (!isNaN(d.getTime())) {
        timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }
    }
    li.innerHTML = `
      <div class="fraud-item__details">
        <div class="fraud-item__user">${escHtml(String(user))}</div>
        <div class="fraud-item__reason">${escHtml(String(reason))}</div>
      </div>
      <div class="fraud-item__time">${timeStr}</div>
    `;
    list.insertBefore(li, list.firstChild);
    // Keep max 5
    while (list.children.length > 5) list.removeChild(list.lastChild);
    // Animate in
    setTimeout(() => li.classList.remove('fraud-item--new'), 50);
  }

  // ── 6. Socket.io live updates ──
  function initSocket() {
    try {
      const socket = io();

      socket.on('fraud_alert', (alert) => {
        addFraudAlert(alert.user, alert.reason, alert.time);
      });

      socket.on('live_metrics', (data) => {
        // Show toast
        const toast = document.createElement('div');
        toast.className = 'admin-toast';
        toast.innerHTML = `<strong>📈 Live Demand Spike:</strong> ${escHtml(data.demand_update.category)} in ${escHtml(data.demand_update.region)} (Score: ${data.demand_update.score})`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 4000);

        // Update demand chart
        if (demandChart) {
          const dsIndex = demandChart.data.datasets.findIndex(d => d.label.toLowerCase() === data.demand_update.category);
          const labelIndex = demandChart.data.labels.indexOf(data.demand_update.region);
          if (dsIndex !== -1 && labelIndex !== -1) {
            demandChart.data.datasets[dsIndex].data[labelIndex] = data.demand_update.score;
            demandChart.update();
          }
        }
      });

      socket.on('connect', () => console.log('[Admin] Socket connected'));
    } catch (e) {
      console.warn('[Admin] Socket.io not available');
    }
  }

  function escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(s)));
    return d.innerHTML;
  }

  // ── Init all ──
  await Promise.all([loadStats(), loadRoutingChart(), loadDemandChart(), loadLeaderboard(), seedFraudList()]);
  initSocket();
})();
