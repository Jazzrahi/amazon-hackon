let cart = [];
    let userCredits = 0;
    let subtotal = 0;
    const currentUser = localStorage.getItem('active_user') || 'user_001';
    
    async function initCheckout() {
      cart = JSON.parse(localStorage.getItem('cart_' + (localStorage.getItem('active_user') || 'user_001'))) || [];
      
      if (cart.length === 0) {
        document.getElementById('loading').textContent = 'Your cart is empty. Please add items to checkout.';
        return;
      }
      
      try {
        const res = await fetch(`/api/user/${currentUser}`);
        if (!res.ok) throw new Error('User fetch failed');
        const user = await res.json();
        userCredits = user.green_credits || 0;
        
        document.getElementById('user-credits-val').textContent = userCredits.toLocaleString();
        
        renderItems();
        updateTotals();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('checkout-container').style.display = 'flex';
      } catch (err) {
        console.error(err);
        document.getElementById('loading').textContent = 'Error loading checkout. Please try again.';
      }
    }
    
    function renderItems() {
      const list = document.getElementById('items-list');
      let html = '';
      subtotal = 0;
      
      cart.forEach(item => {
        const price = item.resale_price || item.price || 0;
        subtotal += price;
        const img = item.image_url || '';
        
        html += `
          <div class="item-row">
            ${img ? `<img src="${img}" class="item-img">` : `<div class="item-img" style="display:flex; align-items:center; justify-content:center; font-size:32px;">📦</div>`}
            <div class="item-details">
              <div class="item-name">${item.name}</div>
              <div class="item-price">₹${price.toLocaleString('en-IN')}</div>
              <div style="font-size: 13px; color: #007600; margin-top: 4px;">In Stock</div>
            </div>
          </div>
        `;
      });
      
      list.innerHTML = html;
      document.getElementById('summ-items').textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    }
    
    function updateTotals() {
      const useCredits = document.getElementById('use-credits-cb').checked;
      let discount = 0;
      
      if (useCredits) {
        discount = Math.min(subtotal, userCredits);
        document.getElementById('summ-discount-row').style.display = 'flex';
        document.getElementById('summ-discount').textContent = `-₹${discount.toLocaleString('en-IN')}`;
      } else {
        document.getElementById('summ-discount-row').style.display = 'none';
      }
      
      const total = subtotal - discount;
      document.getElementById('summ-total').textContent = `₹${total.toLocaleString('en-IN')}`;
      
      // Save exact used credits globally for place order API
      window.creditsApplied = discount;
    }
    
    async function placeOrder() {
      const btn = document.getElementById('place-order-btn');
      btn.textContent = 'Processing...';
      btn.disabled = true;
      
      try {
        const res = await fetch('/api/checkout-cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUser,
            items: cart,
            credits_used: window.creditsApplied || 0
          })
        });
        
        if (!res.ok) throw new Error('Checkout failed');
        
        // Success
        localStorage.removeItem('cart_' + (localStorage.getItem('active_user') || 'user_001'));
        window.dispatchEvent(new Event('storage')); // Update cart badge everywhere
        
        document.getElementById('checkout-container').style.display = 'none';
        document.getElementById('success-screen').style.display = 'block';
        
      } catch (err) {
        console.error(err);
        alert('Failed to place order. Please try again.');
        btn.textContent = 'Place your order';
        btn.disabled = false;
      }
    }
    
    document.addEventListener('DOMContentLoaded', initCheckout);

