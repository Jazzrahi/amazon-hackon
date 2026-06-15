function updateGlobalCartCount() {
      const cc = document.getElementById('nav-cart-count');
      if (cc) {
        const cart = JSON.parse(localStorage.getItem('cart_' + (localStorage.getItem('active_user') || 'user_001'))) || [];
        cc.textContent = cart.length;
      }
    }

    function removeItem(index) {
      let cart = JSON.parse(localStorage.getItem('cart_' + (localStorage.getItem('active_user') || 'user_001'))) || [];
      cart.splice(index, 1);
      localStorage.setItem('cart_' + (localStorage.getItem('active_user') || 'user_001'), JSON.stringify(cart));
      renderCart();
    }

    function renderCart() {
      updateGlobalCartCount();
      const cart = JSON.parse(localStorage.getItem('cart_' + (localStorage.getItem('active_user') || 'user_001'))) || [];
      const container = document.getElementById('cart-items');
      const bottomTotal = document.getElementById('cart-total-bottom');
      const sidebar = document.getElementById('cart-sidebar');
      const sidebarSubtotal = document.getElementById('sidebar-subtotal');

      if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart"><h2>Your Amazon Cart is empty.</h2><a href="/second-life.html" style="color: #007185; text-decoration: none;">Shop today\'s deals</a></div>';
        bottomTotal.innerHTML = '';
        sidebar.style.display = 'none';
        return;
      }

      sidebar.style.display = 'block';
      let html = '';
      let total = 0;

      cart.forEach((item, index) => {
        total += item.resale_price || item.price || 0;
        const img = item.image_url ? item.image_url : '';
        const priceStr = (item.resale_price || item.price || 0).toLocaleString('en-IN');
        
        html += `
          <div class="cart-item">
            ${img ? `<img src="${img}" class="cart-item__image">` : `<div class="cart-item__image" style="display:flex; align-items:center; justify-content:center; font-size:48px;">📦</div>`}
            <div class="cart-item__details">
              <h3 class="cart-item__name">${item.name}</h3>
              <div class="cart-item__price">₹${priceStr}</div>
              <div class="cart-item__stock">In stock</div>
              <div>
                <span style="font-size: 14px;">Qty: 1</span>
                <button class="cart-item__remove" onclick="removeItem(${index})">Delete</button>
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      const totalStr = `Subtotal (${cart.length} item${cart.length !== 1 ? 's' : ''}): <strong>₹${total.toLocaleString('en-IN')}</strong>`;
      bottomTotal.innerHTML = totalStr;
      sidebarSubtotal.innerHTML = totalStr;
    }

    document.addEventListener('DOMContentLoaded', renderCart);
    window.addEventListener('storage', renderCart);

