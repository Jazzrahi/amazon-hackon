(function () {
      'use strict';

      let allItems = [];
      let activeFilter = 'recommended';
      let currentUser = 'user_001';

      // ── User switcher ──
      document.querySelectorAll('.user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentUser = btn.dataset.user;
          loadItems(); // Reload items for the new user's region
        });
      });

      const itemsContainer = document.getElementById('items-container');
      const itemCountEl = document.getElementById('item-count');
      const modalOverlay = document.getElementById('item-modal');
      const modalBody = document.getElementById('modal-body');
      const modalCloseBtn = document.getElementById('modal-close-btn');

      // ── Category icons ──
      function getIcon(cat) {
        return { electronics: '🎧', clothing: '👟', accessories: '🕶️' }[cat] || '📦';
      }

      // ── Grade helpers ──
      function gradeClass(g) { return { A: 'a', B: 'b', C: 'c' }[g] || 'b'; }
      function gradeLabel(g) { return { A: 'Like New', B: 'Good Condition', C: 'Fair' }[g] || g; }
      function gradeExplain(g) {
        return {
          A: 'Inspected by AI. Minimal cosmetic wear — looks and works like new. Fully certified.',
          B: 'Moderate cosmetic wear. All features tested and fully functional. Great value.',
          C: 'Visible wear or minor issues. Priced aggressively for budget-conscious buyers.'
        }[g] || 'AI-graded condition.';
      }

      // ── Mock star ratings ──
      function mockRating() {
        const r = (3.5 + Math.random() * 1.5).toFixed(1);
        const full = Math.floor(r);
        const half = r - full >= 0.5 ? 1 : 0;
        const empty = 5 - full - half;
        return {
          stars: '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty),
          count: Math.floor(200 + Math.random() * 3000),
          value: r
        };
      }

      function escapeHtml(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(String(s)));
        return d.innerHTML;
      }

      // ── Render a product card ──
      function renderCard(item, idx) {
        const gc = gradeClass(item.grade);
        const discount = Math.round(((item.price - item.resale_price) / item.price) * 100);
        const rating = mockRating();

        const card = document.createElement('div');
        card.className = 'product-card animate-in';
        card.style.animationDelay = `${idx * 80}ms`;
        card.dataset.category = item.category;

        const imageContent = item.image_url 
          ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" style="width:100%; height:100%; object-fit:cover;">`
          : `<span class="product-card__image-icon">${getIcon(item.category)}</span>`;

        card.innerHTML = `
          <div class="product-card__image">
            ${imageContent}
            <span class="product-card__trust-badge product-card__trust-badge--${gc}">
              <span class="product-card__trust-badge-icon">✓</span>
              Grade ${escapeHtml(item.grade)} · ${gradeLabel(item.grade)}
            </span>
            <span class="product-card__eco-tag" style="display: none;"></span>
          </div>
          <div class="product-card__body">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span style="background: linear-gradient(135deg, #00A86B, #2ED889); color: white; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(0,168,107,0.2);">✓ Amazon Trusted</span>
              <span style="background: linear-gradient(135deg, #7B61FF, #9B85FF); color: white; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(123,97,255,0.2);">🤖 AI Verified</span>
            </div>
            <div class="product-card__category">${escapeHtml(item.category)}</div>
            <h3 class="product-card__name">${escapeHtml(item.name)}</h3>
            <div class="product-card__pricing">
              <span class="product-card__resale-price">₹${item.resale_price.toLocaleString('en-IN')}</span>
              <span class="product-card__original-price">₹${item.price.toLocaleString('en-IN')}</span>
              <span class="product-card__discount" style="background: #E53935; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 800;">${discount}% off</span>
            </div>
            <div class="product-card__rating">
              <span class="product-card__stars">${rating.stars}</span>
              <span class="product-card__reviews">${rating.count.toLocaleString()} ratings</span>
            </div>
            <div class="product-card__carbon" style="background: rgba(0, 168, 107, 0.08); padding: 10px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; font-weight: 600; color: #067D62; border: 1px solid rgba(0, 168, 107, 0.2);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 16px;">🌍</span>
                <span>Saves <strong>${item.carbon_savings_kg} kg CO₂</strong> vs buying new</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">⚡</span>
                <span style="color: #E07020;">Delivered in <strong>2-3 Hours</strong> (Local Seller)</span>
              </div>
            </div>
            <button class="product-card__cta">View AI Condition Report</button>
          </div>
        `;

        card.addEventListener('click', () => openModal(item));
        return card;
      }

      // ── Render grid ──
      function renderGrid(items) {
        itemsContainer.innerHTML = '';
        
        let filtered = [];
        if (activeFilter === 'all' || activeFilter === 'recommended') {
          filtered = items; // Region filtering is already handled by the API
        } else {
          filtered = items.filter(i => i.category === activeFilter);
        }

        if (filtered.length === 0) {
          itemsContainer.innerHTML = `
            <div class="state-box">
              <div class="state-box__icon">🔍</div>
              <p class="state-box__text">No items found.</p>
            </div>`;
          itemCountEl.textContent = '';
          return;
        }

        itemCountEl.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''} available`;

        const grid = document.createElement('div');
        grid.className = 'card-grid';
        filtered.forEach((item, idx) => grid.appendChild(renderCard(item, idx)));
        itemsContainer.appendChild(grid);
      }

      // ── Filter tabs ──
      document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelector('.filter-tab.active').classList.remove('active');
          tab.classList.add('active');
          activeFilter = tab.dataset.filter;
          renderGrid(allItems);
        });
      });

      // ── Modal ──
      function openModal(item) {
        window.currentModalItem = item; // Store for addToCart

        const gc = gradeClass(item.grade);
        const discount = Math.round(((item.price - item.resale_price) / item.price) * 100);

        modalBody.innerHTML = `
          <h2 class="modal__product-name">${escapeHtml(item.name)}</h2>

          <div class="modal__section">
            <p class="modal__section-label">AI Condition Grade</p>
            <span class="modal__grade-pill modal__grade-pill--${gc}">
              ✓ Grade ${escapeHtml(item.grade)} — ${gradeLabel(item.grade)}
            </span>
            <p class="modal__grade-explain">${gradeExplain(item.grade)}</p>
          </div>

          <div class="modal__section">
            <p class="modal__section-label">Inspection Photos</p>
            <div class="modal__photos">
              <div class="modal__photo">${getIcon(item.category)}</div>
              <div class="modal__photo">📋</div>
              <div class="modal__photo">🔍</div>
              <div class="modal__photo">✅</div>
            </div>
          </div>

          <div class="modal__section">
            <p class="modal__section-label">Pricing</p>
            <div class="modal__pricing-row">
              <span class="modal__big-price">₹${item.resale_price.toLocaleString('en-IN')}</span>
              <span class="modal__old-price">₹${item.price.toLocaleString('en-IN')}</span>
              <span class="modal__savings-pill">Save ${discount}%</span>
            </div>
          </div>

          <div class="modal__section" style="margin-top: 16px;">
            <p class="modal__section-label">Environmental Impact</p>
            <div class="modal__carbon-box" style="margin-bottom: 24px;">
              <span class="modal__carbon-icon">🌍</span>
              <span>Buying this refurbished saves <strong>${item.carbon_savings_kg} kg of CO₂</strong> compared to manufacturing new</span>
            </div>
          </div>

          <div style="display: flex; gap: 12px;">
            <button class="modal__cta-btn" style="flex: 1; background: #FF9900; color: #111;" onclick="buyNow()">⚡ Buy Now — ₹${item.resale_price.toLocaleString('en-IN')}</button>
            <button class="modal__cta-btn" style="flex: 1; background: #f3f3f3; color: #333; border: 1px solid #ddd;" onclick="addToCart()">🛒 Add to Cart</button>
          </div>
        `;

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        modalCloseBtn.focus();
      }

      function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }

      window.buyNow = async function() {
        if (!window.currentModalItem) return;
        
        try {
          const res = await fetch('/api/checkout-second-life', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: currentUser,
              product_id: window.currentModalItem.id
            })
          });
          
          if (!res.ok) throw new Error('Checkout failed');
          
          closeModal();
          showToast('🎉 Purchase successful! Item removed from stocks.');
          
          // Reload items to update stocks
          loadItems();
          
        } catch (err) {
          console.error(err);
          showToast('❌ Failed to process checkout. Please try again.');
        }
      };

      window.addToCart = function() {
        closeModal();
        
        // Add item to localStorage cart
        if (window.currentModalItem) {
          let cart = JSON.parse(localStorage.getItem('cart')) || [];
          cart.push(window.currentModalItem);
          localStorage.setItem('cart', JSON.stringify(cart));
          if (typeof updateGlobalCartCount === 'function') updateGlobalCartCount();
          window.dispatchEvent(new Event('storage'));
        }

        showToast('Added to cart! Complete purchase on Amazon.in');
      };
      
      function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.background = '#00A86B';
        toast.style.color = '#FFFFFF';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '8px';
        toast.style.fontWeight = '600';
        toast.style.fontSize = '14px';
        toast.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
        toast.style.zIndex = '999999';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
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

      modalCloseBtn.addEventListener('click', closeModal);
      modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

      // ── Animated counter ──
      function animateCounter(el, target, prefix, suffix, duration) {
        const start = performance.now();
        const numTarget = parseFloat(String(target).replace(/[^0-9.]/g, ''));
        function tick(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(numTarget * eased * 10) / 10;
          el.textContent = prefix + (Number.isInteger(numTarget) ? Math.round(current).toLocaleString('en-IN') : current.toFixed(1)) + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }

      // ── Load items ──
      async function loadItems() {
        try {
          const userBtn = document.querySelector('.user-btn.active');
          const userRegion = userBtn ? (userBtn.textContent.includes('Delhi') ? 'Delhi' : 'Mumbai') : 'Delhi';
          const locText = document.getElementById('user-location-text');
          if (locText) locText.textContent = userRegion.toUpperCase();

          const res = await fetch(`/api/second-life?region=${userRegion}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          allItems = await res.json();

          if (!allItems || allItems.length === 0) {
            itemsContainer.innerHTML = `
              <div class="state-box">
                <div class="state-box__icon">🏪</div>
                <p class="state-box__text">No items available yet. Check back soon!</p>
              </div>`;
            return;
          }

          renderGrid(allItems);

          // Animate impact stats
          const totalCO2 = allItems.reduce((s, i) => s + (i.carbon_savings_kg || 0), 0);
          const totalSavings = allItems.reduce((s, i) => s + (i.price - i.resale_price), 0);
          animateCounter(document.getElementById('stat-co2'), totalCO2, '', ' kg', 1800);
          animateCounter(document.getElementById('stat-items'), allItems.length, '', '', 1200);
          animateCounter(document.getElementById('stat-savings'), totalSavings, '₹', '', 2000);

        } catch (err) {
          console.error('[SecondLife] Error:', err.message);
          itemsContainer.innerHTML = `
            <div class="state-box">
              <div class="state-box__icon">⚠️</div>
              <p class="state-box__text" style="color: #CC0000;">Failed to load items.</p>
              <button class="retry-btn" onclick="location.reload()">Retry</button>
            </div>`;
        }
      }

      document.addEventListener('DOMContentLoaded', () => {
        loadItems();
        
        // ── Countdown Timer ──
        const timerEl = document.getElementById('countdown-timer');
        let totalSeconds = 2 * 3600 + 45 * 60 + 30; // 2h 45m 30s
        setInterval(() => {
          if (totalSeconds <= 0) return;
          totalSeconds--;
          const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
          const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
          const s = String(totalSeconds % 60).padStart(2, '0');
          if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;
        }, 1000);
      });
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

