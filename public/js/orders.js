(function () {
      'use strict';

      const ICONS = { clothing: '👕', electronics: '🎧', accessories: '🕶️' };

      let currentUserId = 'user_001';

      // ── URL params ──
      const params = new URLSearchParams(window.location.search);
      if (params.get('user')) currentUserId = params.get('user');

      // ── Show banners ──
      if (params.get('status') === 'credit_accepted') {
        document.getElementById('banner-success').classList.add('visible');
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (params.get('status') === 'listed') {
        document.getElementById('banner-listed').classList.add('visible');
        window.history.replaceState({}, '', window.location.pathname);
      }

      // ── User switcher ──
      document.querySelectorAll('.user-btn').forEach(btn => {
        if (btn.dataset.user === currentUserId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
        btn.addEventListener('click', () => {
          currentUserId = btn.dataset.user;
          document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          loadAll();
        });
      });

      // ── Load profile ──
      async function loadProfile() {
        try {
          const res = await fetch(`/api/user/${currentUserId}`);
          if (!res.ok) return;
          const user = await res.json();

          document.getElementById('profile-avatar').textContent = user.name.charAt(0);
          document.getElementById('profile-name').textContent = user.name;
          document.getElementById('profile-region').textContent = `${user.area}, ${user.region}`;
          document.getElementById('profile-trust').textContent = user.trust_score;
          document.getElementById('profile-credits').textContent = `₹${user.green_credits}`;
        } catch (e) {
          console.error('[Profile]', e);
        }
      }

      // ── Load orders ──
      async function loadOrders() {
        const container = document.getElementById('orders-container');
        container.innerHTML = '<div class="state-box"><div class="spinner"></div><p class="state-box__text">Loading orders…</p></div>';

        try {
          const res = await fetch(`/api/orders/${currentUserId}`);
          const orders = await res.json();

          if (!orders || orders.length === 0) {
            container.innerHTML = `<div class="state-box"><div class="state-box__icon">📦</div><p class="state-box__text">No orders in the last 30 days.</p></div>`;
            document.getElementById('order-count').textContent = '';
            return;
          }

          // Fetch products in parallel
          const products = await Promise.all(
            orders.map(o => fetch(`/api/product/${o.product_id}`).then(r => r.ok ? r.json() : null).catch(() => null))
          );

          container.innerHTML = '';
          document.getElementById('order-count').textContent = `${orders.length} order${orders.length !== 1 ? 's' : ''}`;

          orders.forEach((order, idx) => {
            const product = products[idx];
            const card = renderOrderCard(order, product, idx);
            container.appendChild(card);
          });

        } catch (e) {
          console.error('[Orders]', e);
          container.innerHTML = `<div class="state-box"><div class="state-box__icon">⚠️</div><p class="state-box__text" style="color:var(--red-500)">Failed to load orders</p></div>`;
        }
      }

      function renderOrderCard(order, product, idx) {
        const name = product ? product.name : `Order ${order.order_id}`;
        const price = product ? `₹${product.price.toLocaleString('en-IN')}` : '—';
        const icon = product && product.image_url 
          ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(name)}" style="width:100%; height:100%; object-fit:cover;">`
          : (product ? (ICONS[product.category] || '📦') : '📦');
        const eligible = order.status === 'delivered' && !order.returned;

        const card = document.createElement('div');
        card.className = 'order-card';
        card.style.animationDelay = `${idx * 60}ms`;

        // Timeline
        const isDelivered = order.status === 'delivered';
        const isReturned = order.returned;

        card.innerHTML = `
          <div class="order-card__top">
            <div class="order-card__icon">${icon}</div>
            <div class="order-card__details">
              <div class="order-card__name">${escapeHtml(name)}</div>
              <div class="order-card__meta">
                <span>📅 ${formatDate(order.order_date)}</span>
                <span class="order-card__id">${escapeHtml(order.order_id)}</span>
                ${isReturned
                  ? '<span class="status-badge status-badge--returned">↩ Returned</span>'
                  : isDelivered
                    ? '<span class="status-badge status-badge--delivered">✓ Delivered</span>'
                    : ''
                }
              </div>
            </div>
            <div class="order-card__price">${price}</div>
          </div>

          <div class="order-card__timeline">
            <div class="timeline-step">
              <div class="timeline-dot done">✓</div>
              <div class="timeline-label done">Ordered</div>
            </div>
            <div class="timeline-line done"></div>
            <div class="timeline-step">
              <div class="timeline-dot done">✓</div>
              <div class="timeline-label done">Shipped</div>
            </div>
            <div class="timeline-line ${isDelivered ? 'done' : ''}"></div>
            <div class="timeline-step">
              <div class="timeline-dot ${isDelivered ? 'done' : ''}">✓</div>
              <div class="timeline-label ${isDelivered ? 'done' : ''}">Delivered</div>
            </div>
            ${isReturned ? `
              <div class="timeline-line done"></div>
              <div class="timeline-step">
                <div class="timeline-dot returned">↩</div>
                <div class="timeline-label returned">Returned</div>
              </div>
            ` : ''}
          </div>

          ${eligible ? `
            <button class="btn-return" data-product="${escapeHtml(order.product_id)}">
              🤖 Smart Return — AI-Powered
            </button>
          ` : ''}
        `;

        // Smart Return click
        if (eligible) {
          card.querySelector('.btn-return').addEventListener('click', function () {
            window.location.href = `return-flow.html?user_id=${currentUserId}&product_id=${this.dataset.product}`;
          });
        }

        return card;
      }

      function formatDate(d) {
        return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }

      function escapeHtml(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(String(s)));
        return d.innerHTML;
      }

      function loadAll() {
        loadProfile();
        loadOrders();
      }

      loadAll();
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

