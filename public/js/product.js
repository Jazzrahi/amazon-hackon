(function () {
      'use strict';

      // Get product ID from URL or default
      const params = new URLSearchParams(window.location.search);
      let currentProductId = params.get('id') || 'prod_001';

      // Delivery date (3 days from now)
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + 3);
      document.getElementById('p-delivery-date').textContent =
        deliveryDate.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });

      // Mock rating
      function mockRating(seed) {
        const r = (3.8 + (seed % 12) * 0.1).toFixed(1);
        const full = Math.floor(r);
        const half = r - full >= 0.5 ? 1 : 0;
        const empty = 5 - full - half;
        const count = 500 + (seed * 317) % 4000;
        return {
          stars: '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty),
          count: count.toLocaleString('en-IN')
        };
      }

      // Size selector
      document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelector('.size-btn.active')?.classList.remove('active');
          btn.classList.add('active');
        });
      });

      // Fetch and render
      async function loadProduct() {
        try {
          const res = await fetch(`/api/product/${currentProductId}`);
          if (!res.ok) throw new Error('Product not found');
          const product = await res.json();

          const icon = '📦';
          const seed = parseInt(product.id.replace(/\D/g, '')) || 1;
          const rating = mockRating(seed);
          const mrp = Math.round(product.price * 1.25);

          // Update page
          if (product.image_url) {
            document.getElementById('product-icon').innerHTML = `<img src="${product.image_url}" style="width:100%; height:100%; object-fit:cover;">`;
          } else {
            document.getElementById('product-icon').textContent = icon;
          }
          document.getElementById('product-badge').textContent =
            product.high_return_risk ? '⚠ HIGH RETURN RATE' : '✓ AMAZON CHOICE';
          document.getElementById('product-badge').style.background =
            product.high_return_risk ? '#E07020' : 'var(--navy-700)';
          document.getElementById('breadcrumb-name').textContent = product.name;
          document.getElementById('p-category').textContent = product.category;
          document.getElementById('p-name').textContent = product.name;
          document.getElementById('p-stars').textContent = rating.stars;
          document.getElementById('p-reviews').textContent = `${rating.count} ratings`;
          document.getElementById('p-price').textContent = `₹${product.price.toLocaleString('en-IN')}`;
          document.getElementById('p-mrp').textContent = `M.R.P: ₹${mrp.toLocaleString('en-IN')}`;
          document.title = `${product.name} — Second Life Commerce`;

          // Size selector visibility
          if (product.category === 'clothing') {
            document.getElementById('size-section').classList.add('visible');
          }

          // Details table
          document.getElementById('dt-brand').textContent = product.name.split(' - ')[0] || product.name;
          document.getElementById('dt-category').textContent = product.category.charAt(0).toUpperCase() + product.category.slice(1);
          document.getElementById('dt-return-rate').textContent = `${product.return_rate}% of buyers return this item`;
          document.getElementById('dt-shipping').textContent = `₹${product.return_shipping_cost}`;
          document.getElementById('dt-carbon').textContent = `${product.carbon_savings_kg} kg CO₂ saved if refurbished`;

          // Thumbnails
          document.querySelectorAll('.product-image__thumb').forEach(t => {
            if (product.image_url) {
              t.innerHTML = `<img src="${product.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;">`;
            } else {
              t.textContent = icon;
            }
          });

          // ─── Eco Alert ───
          renderEcoAlert(product);

        } catch (err) {
          console.error('[Product] Error:', err.message);
          document.getElementById('p-name').textContent = 'Product not found';
        }
      }

      function renderEcoAlert(product) {
        const container = document.getElementById('eco-alert-container');
        const isHighRisk = product.high_return_risk === true;

        let alertHTML = '';

        if (isHighRisk) {
          alertHTML = `
            <div class="eco-alert eco-alert--high">
              <div class="eco-alert__header">
                <span class="eco-alert__icon">⚠️</span>
                <span class="eco-alert__tag">AI Return Prevention</span>
              </div>
              <p class="eco-alert__text">
                <strong>Eco-Alert:</strong> <strong>${product.return_rate}%</strong> of customers with your purchase history return this brand${product.category === 'clothing' ? ' for sizing issues' : ''}. 
                ${product.category === 'clothing' ? 'Consider sizing up to <strong>save packaging and carbon emissions!</strong>' : 'Please review specifications carefully before purchasing.'}
              </p>
              ${product.sizing_advice ? `
                <div class="eco-alert__sizing">
                  👕 ${escapeHtml(product.sizing_advice)}
                </div>
              ` : ''}
            </div>
          `;
        } else {
          alertHTML = `
            <div class="eco-alert eco-alert--low">
              <div class="eco-alert__header">
                <span class="eco-alert__icon">🌱</span>
                <span class="eco-alert__tag">Low Return Rate</span>
              </div>
              <p class="eco-alert__text">
                Great choice! Only <strong>${product.return_rate}%</strong> of customers return this item. 
                Buying this saves <strong>${product.carbon_savings_kg} kg of CO₂</strong> compared to average products.
              </p>
            </div>
          `;
        }

        container.innerHTML = alertHTML;
      }

      function escapeHtml(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(String(s)));
        return d.innerHTML;
      }

      async function loadRelatedProducts() {
        const carousel = document.getElementById('related-carousel');
        try {
          const res = await fetch('/api/products');
          const allProducts = await res.json();
          // Filter out current product and grab up to 6
          const related = allProducts.filter(p => p.id !== currentProductId).slice(0, 6);
          
          carousel.innerHTML = related.map(p => {
            const icon = p.image_url 
              ? `<img src="${escapeHtml(p.image_url)}">`
              : `<div style="font-size: 40px; text-align: center; line-height: 150px;">📦</div>`;
            return `
              <div class="related-card" style="width: 150px; flex-shrink: 0; cursor: pointer;" onclick="window.location.href='product.html?id=${p.id}'">
                <div class="related-card__img-wrapper">${icon}</div>
                <div style="font-size: 13px; font-weight: 600; color: #0f1111; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(p.name)}
                </div>
                <div style="font-size: 14px; font-weight: 700; color: #B12704;">
                  ₹${p.price.toLocaleString('en-IN')}
                </div>
              </div>
            `;
          }).join('');
        } catch(e) {
          carousel.innerHTML = '<div style="color: #666; font-size: 14px;">No related products found.</div>';
        }
      }

      // Init
      loadProduct();
      loadRelatedProducts();
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

// Add to Cart and Buy Now functionality for product page
  (function() {
    function getCurrentProduct() {
      const id = new URLSearchParams(window.location.search).get('id') || 'prod_001';
      const name = document.getElementById('p-name').textContent;
      const priceText = document.getElementById('p-price').textContent.replace(/[^0-9]/g, '');
      const price = parseInt(priceText) || 0;
      const imgEl = document.querySelector('#product-image img');
      const image_url = imgEl ? imgEl.src : null;
      return { id, name, price, image_url };
    }

    function showToast(msg) {
      const toast = document.createElement('div');
      toast.textContent = msg;
      toast.style.position = 'fixed';
      toast.style.bottom = '24px';
      toast.style.right = '24px';
      toast.style.background = '#00A86B';
      toast.style.color = '#FFF';
      toast.style.padding = '12px 20px';
      toast.style.borderRadius = '8px';
      toast.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
      toast.style.zIndex = '999999';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.transition = 'all 0.3s cubic-bezier(0.175,0.885,0.32,1.275)';
      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
      });
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    function addToCart() {
      const product = getCurrentProduct();
      let cart = JSON.parse(localStorage.getItem('cart')) || [];
      cart.push(product);
      localStorage.setItem('cart', JSON.stringify(cart));
      if (typeof updateGlobalCartCount === 'function') updateGlobalCartCount();
      window.dispatchEvent(new Event('storage'));
      showToast('Item added to cart!');
    }

    async function buyNow(event) {
      const btn = event.target || document.querySelector('.btn-buy--now');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span style="opacity:0.6">Processing...</span>';

      const product = getCurrentProduct();
      const userId = new URLSearchParams(window.location.search).get('user_id') || 'user_001';

      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, product_id: product.id })
        });
        
        if (!response.ok) {
           const errData = await response.json().catch(() => ({}));
           throw new Error(errData.error || 'Order failed');
        }

        // Show success state on button
        btn.innerHTML = '✓ Order Confirmed!';
        btn.style.background = '#00A86B';
        btn.style.color = '#FFF';

        // Clear the cart
        localStorage.removeItem('cart');
        if (typeof updateGlobalCartCount === 'function') updateGlobalCartCount();
        window.dispatchEvent(new Event('storage'));

        // Show overlay with redirect message
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '999998';

        const modal = document.createElement('div');
        modal.style.background = '#fff';
        modal.style.padding = '24px 32px';
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
        modal.style.maxWidth = '320px';
        modal.style.textAlign = 'center';
        modal.style.fontWeight = '600';
        modal.textContent = 'Purchase confirmed! Redirecting to Orders...';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        setTimeout(() => {
          window.location.href = `/orders.html?user_id=${userId}`;
        }, 1500);

      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        alert('Purchase failed: ' + err.message);
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      const btnCart = document.querySelector('.btn-buy--cart');
      const btnNow = document.querySelector('.btn-buy--now');
      if (btnCart) btnCart.addEventListener('click', addToCart);
      if (btnNow) btnNow.addEventListener('click', buyNow);
    });
  })();

