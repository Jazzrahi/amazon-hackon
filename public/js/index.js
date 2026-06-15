function animateValue(el, target, prefix, suffix, duration) {
      const start = performance.now();
      const num = parseFloat(String(target).replace(/[^0-9.]/g, ''));
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const e = 1 - Math.pow(1 - p, 3);
        const v = num * e;
        el.textContent = prefix + (Number.isInteger(num) ? Math.round(v).toLocaleString('en-IN') : v.toFixed(1)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    async function loadStats() {
      try {
        const res = await fetch('/api/sustainability-stats');
        const s = await res.json();
        animateValue(document.getElementById('hs-co2'), s.total_co2_saved_kg, '', '', 2000);
        animateValue(document.getElementById('hs-items'), s.items_rescued, '', '', 1500);
        animateValue(document.getElementById('hs-credits'), s.total_green_credits_issued, '₹', '', 2200);
        // Calculate equivalent car trips avoided (0.21kg CO₂/km, 50km per trip)
        const trips = Math.round(s.total_co2_saved_kg / (0.21 * 50));
        document.getElementById('hs-co2-equivalent').textContent = trips;
      } catch (e) {
        console.error('[Stats]', e);
      }
    }

    async function loadProducts() {
      try {
        const res = await fetch('/api/products');
        const products = await res.json();
        
        const row1Products = products.slice(0, 4);
        const row2Products = products.slice(4, 7);

        function renderRow(containerId, items) {
          const container = document.getElementById(containerId);
          if (!container) return;
          container.innerHTML = items.map(p => {
            const icon = p.image_url 
              ? `<img src="${p.image_url}" alt="${p.name}">`
              : `<div style="font-size: 40px;">📦</div>`;
            return `
              <a href="/product.html?id=${p.id}" class="product-card">
                <div class="product-card__img-wrapper">
                  ${icon}
                </div>
                <div class="product-card__name">${p.name}</div>
                <div class="product-card__price">₹${p.price.toLocaleString('en-IN')}</div>
              </a>
            `;
          }).join('');
        }

        renderRow('row-trends', row1Products);
        renderRow('row-secondlife', row2Products);
      } catch (e) {
        console.error('[Products]', e);
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      loadStats();
      loadProducts();
    });

function updateGlobalCartCount() {
    const cc = document.getElementById('nav-cart-count');
    if (cc) {
      const cart = JSON.parse(localStorage.getItem('cart_' + (localStorage.getItem('active_user') || 'user_001'))) || [];
      cc.textContent = cart.length;
    }
  }
  document.addEventListener('DOMContentLoaded', updateGlobalCartCount);
  // Optional: Listen for custom events if added on same page
  window.addEventListener('storage', updateGlobalCartCount);

