const params = new URLSearchParams(window.location.search);
    const userId = params.get('user_id') || localStorage.getItem('active_user') || 'user_001';
    const productId = params.get('product_id') || 'prod_001';

    let returnData = null;

    // ── Elements ──
    const uploadAreaBill = document.getElementById('upload-area-bill');
    const uploadIconBill = document.getElementById('upload-icon-bill');
    const uploadTextBill = document.getElementById('upload-text-bill');
    const submitBtnBill  = document.getElementById('submit-btn-bill');
    const fileInputBill  = document.getElementById('file-input-bill');
    const stepUploadBill = document.getElementById('step-upload-bill');

    const uploadArea        = document.getElementById('upload-area');
    const uploadIcon        = document.getElementById('upload-icon');
    const uploadText        = document.getElementById('upload-text');
    const submitBtn         = document.getElementById('submit-btn');
    const fileInput         = document.getElementById('file-input');
    const stepUploadProduct = document.getElementById('step-upload-product');

    const stepReason        = document.getElementById('step-reason');
    const reasonSelect      = document.getElementById('reason-select');
    const reasonOther       = document.getElementById('reason-other');
    const reasonDesc        = document.getElementById('reason-description');
    const validateReasonBtn = document.getElementById('validate-reason-btn');
    const reasonResult      = document.getElementById('reason-result');

    const stepAnalysis = document.getElementById('step-analysis');
    const stepResult   = document.getElementById('step-result');

    let billUploaded = false;
    let base64Bill   = null;
    let photoUploaded = false;
    let base64Image  = null;
    let imageMime    = null;

    // ── Bill upload ──
    uploadAreaBill.addEventListener('click', () => { if (!billUploaded) fileInputBill.click(); });
    // Show reason selection when product photo is ready
    reasonSelect.addEventListener('change', () => {
      reasonOther.style.display = reasonSelect.value === 'other' ? 'block' : 'none';
    });
    // Enable validate button when description entered
    reasonDesc.addEventListener('input', () => {
      validateReasonBtn.disabled = !(reasonSelect.value && reasonDesc.value.trim().length > 0);
    });
    // Validate reason and photo
    validateReasonBtn.addEventListener('click', async () => {
      validateReasonBtn.textContent = 'Validating...';
      validateReasonBtn.disabled = true;
      try {
        const payload = {
          reason: reasonSelect.value,
          customReason: reasonOther.value.trim(),
          description: reasonDesc.value.trim(),
          photo: base64Image
        };
        const res = await fetch('/api/validate-return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        reasonResult.textContent = data.message;
        reasonResult.style.color = data.match ? 'var(--green-600)' : 'var(--red-500)';
        if (data.match) {
          // Brief pause so user can read the success message
          await new Promise(r => setTimeout(r, 1000));
          // Proceed to analysis step
          stepReason.classList.add('hidden');
          startAnalysis();
        } else {
          validateReasonBtn.textContent = 'Validate Reason';
          validateReasonBtn.disabled = false;
        }
      } catch (err) {
        reasonResult.textContent = '❌ Error validating reason. Please try again.';
        reasonResult.style.color = 'var(--red-500)';
        validateReasonBtn.textContent = 'Validate Reason';
        validateReasonBtn.disabled = false;
      }
    });

    // After product photo upload, show reason step
    const startAnalysis = async () => {
       // Hide reason step, show analysis step
       stepReason.classList.add('hidden');
       stepAnalysis.classList.remove('hidden');
       updateProgress(4); // progress to analysis step

       // Build payload with image and reason data
       const payload = { user_id: userId, product_id: productId };
       if (base64Image) {
         payload.image_base64 = base64Image;
         payload.image_mime = imageMime;
       }
       // add reason information
       payload.reason = reasonSelect.value;
       payload.customReason = reasonOther.value.trim();
       payload.description = reasonDesc.value.trim();

       // Run analysis animation
       await runAnalysisAnimation();

       // Call backend to process return
       try {
         const data = await fetch('/api/process-return', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(payload)
         }).then(r => r.json());
         showResult(data);
       } catch (e) {
         alert('Error processing return. Please try again.');
         // Return to reason step on failure
         stepAnalysis.classList.add('hidden');
         stepReason.classList.remove('hidden');
         updateProgress(3);
       }
     };

    fileInputBill.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const reader = new FileReader();
        reader.onloadend = () => {
          base64Bill = reader.result.split(',')[1];
          uploadAreaBill.classList.add('uploaded');
          uploadIconBill.textContent = '✅';
          uploadTextBill.textContent = 'Bill photo ready';
          billUploaded = true;
          submitBtnBill.disabled = false;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });

    submitBtnBill.addEventListener('click', async () => {
      if (!billUploaded) return;
      submitBtnBill.textContent = 'Verifying...';
      submitBtnBill.disabled = true;
      try {
        const res  = await fetch('/api/verify-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64Bill, product_id: productId })
        });
        const data = await res.json();
        if (data.isValid) {
          stepUploadBill.classList.add('hidden');
          stepUploadProduct.classList.remove('hidden');
          updateProgress(2);
        } else {
          alert('Bill validation failed: ' + data.message);
          submitBtnBill.textContent = 'Verify Bill';
          submitBtnBill.disabled = false;
        }
      } catch {
        alert('Error verifying bill.');
        submitBtnBill.textContent = 'Verify Bill';
        submitBtnBill.disabled = false;
      }
    });

    // ── Product photo ──
    uploadArea.addEventListener('click', () => { if (!photoUploaded) fileInput.click(); });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file   = e.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          imageMime    = result.split(';')[0].split(':')[1];
          base64Image  = result.split(',')[1];
          uploadArea.classList.add('uploaded');
          uploadIcon.textContent = '✅';
          uploadText.textContent = 'Photo ready — AI will score 0–100';
          photoUploaded = true;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Analyze with AI →';
        };
        reader.readAsDataURL(file);
      }
    });

    // ── Submit Product ──
    submitBtn.addEventListener('click', async () => {
       if (!photoUploaded) return;
       stepUploadProduct.classList.add('hidden');
       stepReason.classList.remove('hidden');
       updateProgress(3);
    });

    // ── Analysis animation ──
    async function runAnalysisAnimation() {
      const steps = ['as-1', 'as-2', 'as-3', 'as-4', 'as-5'];
      const bar   = document.getElementById('analysis-bar-fill');
      for (let i = 0; i < steps.length; i++) {
        const el = document.getElementById(steps[i]);
        el.classList.add('active');
        bar.style.width = `${((i + 0.5) / steps.length) * 100}%`;
        await sleep(600 + Math.random() * 400);
        el.classList.remove('active');
        el.classList.add('done');
        bar.style.width = `${((i + 1) / steps.length) * 100}%`;
        await sleep(200);
      }
      await sleep(400);
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ── Show Result ──
    function showResult(data) {
      stepAnalysis.classList.add('hidden');
      stepResult.classList.remove('hidden');
      updateProgress(4);

      // Grade badge
      const gc  = { A: 'a', B: 'b', C: 'c' }[data.grade] || 'b';
      const gl  = { A: 'Like New', B: 'Good Condition', C: 'Fair / Worn' }[data.grade] || data.grade;
      const qs  = data.quality_score || 0;
      const barClass = qs >= 70 ? 'high' : qs >= 50 ? 'mid' : 'low';

      document.getElementById('grade-display').innerHTML = `
        <div class="grade-badge grade-badge--${gc}">✓ Grade ${data.grade} — ${gl}</div>
        <div class="grade-confidence" style="margin-bottom:4px">AI Quality Score</div>
        <div class="quality-bar-wrap">
          <div class="quality-bar-label"><span>0</span><span id="qs-label">${qs}/100</span></div>
          <div class="quality-bar"><div class="quality-bar__fill quality-bar__fill--${barClass}" id="qs-bar" style="width:0%"></div></div>
        </div>
        <p class="grade-explain" style="margin-top:10px">${data.grade_explanation}</p>
      `;

      // Animate quality bar
      setTimeout(() => {
        const bar = document.getElementById('qs-bar');
        if (bar) bar.style.width = qs + '%';
      }, 200);

      // Show decision card
      const decision = data.decision;
      const card = document.getElementById(`result-${decision}`);
      if (card) {
        card.classList.add('visible');
        populateCard(data);
      }
    }

    function populateCard(d) {
      const name  = d.product_name || 'Product';
      const price = d.product_price || 0;
      const co2   = d.carbon_saved_kg || d.carbon_savings_kg || 0;
      const qs    = d.quality_score || 0;

      if (d.decision === 'keep_item') {
        document.getElementById('keep-quality-score').textContent = qs;
        document.getElementById('keep-amount').textContent = `₹${(d.partial_refund_amount || 0).toLocaleString('en-IN')}`;
        document.getElementById('keep-amount-sub').textContent =
          `${d.partial_refund_percent || 0}% instant refund — cheaper than a warehouse return!`;
        document.getElementById('keep-info').innerHTML = infoRows([
          ['Item', name],
          ['Original Price', `₹${price.toLocaleString('en-IN')}`],
          ['Partial Refund', `₹${(d.partial_refund_amount || 0).toLocaleString('en-IN')} (${d.partial_refund_percent || 0}%)`],
          ['AI Quality Score', `${qs}/100 — ${d.grade === 'A' ? 'Like New' : 'Good Condition'}`],
        ]);
        document.getElementById('keep-eco-text').textContent =
          `Keeping this item saves ~${co2} kg of CO₂ — that's ${Math.round(co2 * 4)} km of car emissions!`;

        // Hide "List on Second Life" button if quality < 50 (Tier 2 not available)
        if (qs < 50) {
          const btn = document.getElementById('keep-to-secondlife-btn');
          if (btn) btn.style.display = 'none';
        }
      }

      if (d.decision === 'second_life') {
        document.getElementById('sl-quality-score').textContent = qs;
        document.getElementById('sl-info').innerHTML = infoRows([
          ['Item', name],
          ['Suggested Resale Price', `₹${(d.resale_price || 0).toLocaleString('en-IN')}`],
          ['Discount from Original', `${d.markdown_percent || 30}% off`],
          ['You receive', '100% refund on sale'],
          ['Local Demand', d.demand_classification === 'high' ? '🔥 High' : '📦 Moderate'],
        ]);
        document.getElementById('sl-eco-text').textContent =
          `Reselling saves ~${co2} kg of CO₂ vs manufacturing new — equivalent to ${Math.round(co2 * 4)} km of driving!`;
      }

      if (d.decision === 'standard_return') {
        document.getElementById('sr-quality-score').textContent = qs;
        document.getElementById('standard-info').innerHTML = infoRows([
          ['Item', name],
          ['AI Quality Score', `${qs}/100 — Requires Inspection`],
          ['Return Method', 'Prepaid shipping label (sent to email)'],
          ['Pickup', d.pickup?.scheduled ? `${d.pickup.pickup_day || 'Any day'}, ${d.pickup.time_window || 'Standard Drop-off'}` : 'Drop-off at nearest point'],
          ['Refund Timeline', '5–7 business days'],
        ]);
      }

      if (d.decision === 'fraud_rejected') {
        document.getElementById('fraud-info').innerHTML = infoRows([
          ['Expected Item', name],
          ['AI Quality Score', '0/100 — Item mismatch'],
          ['Reason', 'Image does not match product'],
          ['Action Required', 'Manual inspection required'],
          ['Account Status', 'Under Review'],
        ]);
      }
    }

    function infoRows(rows) {
      return rows.map(([l, v]) =>
        `<div class="info-row"><span class="info-row__label">${l}</span><span class="info-row__value">${v}</span></div>`
      ).join('');
    }

    // ── Actions ──
    async function acceptKeepItem() {
      if (!returnData) return;
      const btn = document.getElementById('keep-accept-btn');
      btn.textContent = 'Processing…';
      btn.disabled = true;
      try {
        await fetch('/api/accept-green-credit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            product_id: productId,
            amount: returnData.partial_refund_amount || 0
          })
        });
      } catch {}
      location.href = 'orders.html?status=credit_accepted';
    }

    async function listForResale() {
      if (!returnData) return;
      try {
        await fetch('/api/list-for-resale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            product_id: productId,
            grade: returnData.grade,
            resale_price: returnData.resale_price
          })
        });
      } catch {}
      location.href = 'second-life.html?status=listed';
    }

    // From Tier 1 card — "List on Second Life instead"
    function showSecondLifeFromKeep() {
      document.getElementById('result-keep_item').classList.remove('visible');
      const sl = document.getElementById('result-second_life');
      sl.classList.add('visible');
      if (returnData) {
        // Make sure second life card is populated
        returnData.decision = 'second_life';
        populateCard(returnData);
      }
    }

    // ── Progress bar ──
    function updateProgress(step) {
      for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`prog-${i}`);
        if (!el) continue;
        el.classList.remove('active', 'done');
        if (i < step)  el.classList.add('done');
        if (i === step) el.classList.add('active');
      }
    }

function updateGlobalCartCount() {
      const cc = document.getElementById('nav-cart-count');
      if (cc) {
        const cart = JSON.parse(localStorage.getItem('cart_' + (localStorage.getItem('active_user') || 'user_001'))) || [];
        cc.textContent = cart.length;
      }
    }
    document.addEventListener('DOMContentLoaded', updateGlobalCartCount);
    window.addEventListener('storage', updateGlobalCartCount);

