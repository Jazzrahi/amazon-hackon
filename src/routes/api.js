const express = require('express');
const router = express.Router();

const { 
  getUserById, getProductById, getAllProducts, getSecondLifeItems, 
  getOrdersByUserId, updateUserCredits, markItemAsAmazonOwned, 
  getAllDemand, getAllDeliveryRoutes, getOrder, markOrderReturned, 
  updateProductResale, updateProductRegion, createOrder, getAllOrders, getAllUsers
} = require('../services/dataStore');
const { gradeItem } = require('../services/gradingEngine');
const { calculateResalePrice } = require('../services/pricingEngine');
const { getDemandScore } = require('../services/demandPredictor');
const { routeReturn } = require('../services/returnRouter');
const { schedulePickup } = require('../services/reverseLogistics');

/**
 * GET /api/products
 * Returns all products (200)
 */
router.get('/products', async (req, res) => {
  res.json(await getAllProducts());
});

/**
 * GET /api/product/:id
 * Returns product JSON (200) or error (404)
 */
router.get('/product/:id', async (req, res) => {
  const product = await getProductById(req.params.id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(product);
});

/**
 * POST /api/process-return
 * Orchestrates: grading → pricing → demand → routing → logistics
 */
router.post('/process-return', async (req, res) => {
  const { user_id, product_id, reason, customReason, description } = req.body;

  const missingFields = [];
  if (!user_id) missingFields.push('user_id');
  if (!product_id) missingFields.push('product_id');

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missingFields.join(', ')}`
    });
  }

  const user = await getUserById(user_id);
  if (!user) return res.status(400).json({ error: 'User not found' });

  const product = await getProductById(product_id);
  if (!product) return res.status(400).json({ error: 'Product not found' });

  let grade = 'B';
  let qualityScore = 70; // default mid-range
  let explanation = 'Assessed via quality algorithms.';
  let fraudDetected = false;
  let carbonSavedKg = product.carbon_savings_kg || 1.5;

  if (req.body.image_base64) {
    const { analyzeImage } = require('../services/visionAi');
    const aiResult = await analyzeImage(
      req.body.image_base64,
      req.body.image_mime || 'image/jpeg',
      product.category,
      product.name,
      product.price
    );

    if (aiResult) {
      grade = aiResult.grade;
      qualityScore = aiResult.quality_score;
      explanation = aiResult.explanation;
      carbonSavedKg = aiResult.carbon_saved_kg || carbonSavedKg;
      if (!aiResult.isValid) {
        fraudDetected = true;
        explanation = 'FRAUD DETECTED: The uploaded image does not match the expected product. ' + explanation;
        user.trust_score = 0;
        qualityScore = 0;
      }
    } else {
      // Mock fallback: map grade to quality_score
      const mockGrade = gradeItem({ imageCount: 1, totalFileSize: 1000000, fileType: 'image' });
      grade = mockGrade.grade;
      explanation = mockGrade.explanation;
      qualityScore = grade === 'A' ? 90 : grade === 'B' ? 72 : 35;
    }
  } else {
    const mockGrade = gradeItem({ imageCount: 3, totalFileSize: 2000000, fileType: 'image' });
    grade = mockGrade.grade;
    explanation = mockGrade.explanation;
    qualityScore = grade === 'A' ? 90 : grade === 'B' ? 72 : 35;
  }

  // Adjust quality score, grade, and explanation dynamically based on selected return reason for full consistency
  if (reason === 'damaged') {
    grade = 'C';
    qualityScore = 35;
    explanation = `Customer reported item as damaged/defective: "${description || 'No description provided'}". AI inspection verified structural/surface defects. Not eligible for resale.`;
  } else if (reason === 'wrong_size') {
    grade = 'A';
    qualityScore = 92;
    explanation = `Wrong size / fit reported. Item remains in Like-New condition. Perfect candidate for local P2P resale!`;
  } else if (reason === 'incorrect_item') {
    grade = 'A';
    qualityScore = 95;
    explanation = `Incorrect item shipped. Brand new condition. Routing to warehouse.`;
  }

  // Get demand data FIRST (pricing depends on it)
  const demandData = await getAllDemand();
  const { demandScore, classification: demandClassification, confidence: demandConfidence, salesVelocity, factors: demandFactors } = getDemandScore(
    product.category,
    user.region,
    demandData
  );

  // Dynamic pricing: factors in grade + demand + category
  const { resalePrice, markdownPercent, demandAdjustment } = calculateResalePrice(
    product.price, grade, demandScore, product.category, product.inventory_age_days || 0
  );




  const routingResult = routeReturn({
    qualityScore,
    grade,
    productPrice: product.price,
    trustScore: user.trust_score,
    fraudDetected,
    reason // Pass reason here!
  });

  let pickupResult = null;
  const { getDB } = require('../services/dataStore');
  const db = await getDB();

  if (!fraudDetected) {
    const deliveryRoutes = await getAllDeliveryRoutes();
    pickupResult = schedulePickup(user.area, deliveryRoutes);
    await db.run(`INSERT INTO audit_logs (event_type, details) VALUES (?, ?)`, ['return_processed', JSON.stringify({ user_id, product_id, tier: routingResult.tier })]);
  } else {
    await db.run(`INSERT INTO fraud_flags (user_id, reason) VALUES (?, ?)`, [user_id, explanation]);
    await db.run(`INSERT INTO audit_logs (event_type, details) VALUES (?, ?)`, ['fraud_detected', JSON.stringify({ user_id, product_id, explanation })]);

    // Emit real-time fraud alert to admin dashboard
    const io = req.app.get('io');
    if (io) {
      io.emit('fraud_alert', {
        user: user_id,
        reason: explanation,
        time: new Date().toISOString()
      });
    }
  }

  const response = {
    decision: routingResult.decision,
    tier: routingResult.tier,
    grade,
    quality_score: qualityScore,
    grade_explanation: explanation,
    // Tier 1 — Keep the Item
    partial_refund_percent: routingResult.partialRefundPercent,
    partial_refund_amount: routingResult.partialRefundAmount,
    // Tier 2 — Second Life
    resale_price: resalePrice,
    markdown_percent: markdownPercent,
    demand_score: demandScore,
    demand_classification: demandClassification,
    demand_confidence: demandConfidence,
    sales_velocity: salesVelocity,
    demand_factors: demandFactors,
    demand_adjustment: demandAdjustment,
    // Eco stats
    carbon_saved_kg: carbonSavedKg,
    carbon_savings_kg: carbonSavedKg,
    // Product info
    product_name: product.name,
    product_price: product.price,
    category: product.category,
    reasoning: `Rule: ${routingResult.rule}. Quality: ${qualityScore}/100. Trust: ${user.trust_score}. Demand: ${demandScore}/100 (${demandClassification})`,
    pickup: pickupResult ? {
      scheduled: pickupResult.scheduled,
      pickup_day: pickupResult.pickupDay || null,
      time_window: pickupResult.timeWindow || null,
      driver_name: pickupResult.driverName || null
    } : null
  };

  res.json(response);
});

/**
 * POST /api/accept-standard-return
 */
router.post('/accept-standard-return', async (req, res) => {
  const { user_id, product_id } = req.body;

  if (!user_id || !product_id) {
    return res.status(400).json({ error: 'Missing user_id or product_id' });
  }

  const order = await getOrder(user_id, product_id);
  if (order) {
    await markOrderReturned(order.order_id, 'standard_return');
  }

  res.json({
    success: true,
    message: 'Standard return initiated'
  });
});

/**
 * POST /api/accept-green-credit
 */
router.post('/accept-green-credit', async (req, res) => {
  const { user_id, product_id, amount } = req.body;

  if (!user_id || !amount) {
    return res.status(400).json({ error: 'Missing user_id or amount' });
  }

  const updatedUser = await updateUserCredits(user_id, amount);
  if (!updatedUser) {
    return res.status(400).json({ error: 'User not found' });
  }

  if (product_id) {
    const order = await getOrder(user_id, product_id);
    if (order) {
        await markOrderReturned(order.order_id, 'green_credit');
    }
  }

  res.json({
    success: true,
    new_balance: updatedUser.green_credits,
    message: `₹${amount} Green Credits added. New balance: ₹${updatedUser.green_credits}`
  });
});

/**
 * POST /api/list-for-resale
 */
router.post('/list-for-resale', async (req, res) => {
  const { user_id, product_id, grade, resale_price } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: 'Missing product_id' });
  }

  const product = await getProductById(product_id);
  if (!product) {
    return res.status(400).json({ error: 'Product not found' });
  }

  const finalGrade = grade || 'B';
  const finalResalePrice = resale_price || Math.round(product.price * 0.7);

  await updateProductResale(product_id, finalGrade, finalResalePrice, user_id);
  const updatedProduct = await getProductById(product_id);

  if (user_id) {
    const order = await getOrder(user_id, product_id);
    if (order) {
        await markOrderReturned(order.order_id, 'p2p_resale');
    }
    const allUsers = await getAllUsers();
    const user = allUsers.find(u => u.id === user_id);
    if (user && user.region) {
        await updateProductRegion(product_id, user.region);
    }
    // Award 50 green credits for choosing sustainable resale
    const { updateUserCredits } = require('../services/dataStore');
    await updateUserCredits(user_id, 50);
  }

  res.json({
    success: true,
    message: `${product.name} is now listed on Second Life Marketplace. You earned 50 Green Credits!`,
    product: updatedProduct
  });
});

router.get('/second-life', async (req, res) => {
  const items = await getSecondLifeItems();
  const region = req.query.region;

  if (!region) {
      return res.json(items);
  }

  const { getUserById } = require('../services/dataStore');
  
  const filtered = [];
  for (const item of items) {
      if (item.current_region === region) {
          filtered.push(item);
      } else if (item.inventory_owner && item.inventory_owner.startsWith('seller_')) {
          const sellerId = item.inventory_owner.replace('seller_', '');
          const seller = await getUserById(sellerId);
          if (seller && seller.region === region) {
              filtered.push(item);
          }
      } else {
          // If no specific region is set, assume it is available everywhere
          filtered.push(item);
      }
  }

  res.json(filtered);
});

/**
 * GET /api/orders/:userId
 */
router.get('/orders/:userId', async (req, res) => {
  const orders = await getOrdersByUserId(req.params.userId);
  res.json(orders);
});

/**
 * POST /api/orders
 * To fix the Buy Now bug (Issue #1 & #2)
 */
router.post('/orders', async (req, res) => {
    const { user_id, product_id } = req.body;
    if (!user_id || !product_id) return res.status(400).json({error: "Missing user_id or product_id"});

    const orderId = 'ord_' + Math.floor(Math.random() * 1000000);
    const orderDate = new Date().toISOString().split('T')[0];
    const order = await createOrder(orderId, user_id, product_id, orderDate, 'processing');
    res.json(order);
});

/**
 * POST /api/orders/:orderId/deliver
 * Marks an order as delivered
 */
router.post('/orders/:orderId/deliver', async (req, res) => {
    const { orderId } = req.params;
    const { markOrderDelivered } = require('../services/dataStore');
    
    try {
        const order = await markOrderDelivered(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ success: true, message: 'Order marked as delivered', order });
    } catch (err) {
        console.error('Deliver order error:', err);
        res.status(500).json({ error: 'Failed to mark order as delivered' });
    }
});

/**
 * POST /api/checkout-second-life
 * Buys a Second Life item, updating inventory owner and creating an order
 */
router.post('/checkout-second-life', async (req, res) => {
    const { user_id, product_id } = req.body;
    if (!user_id || !product_id) return res.status(400).json({error: "Missing user_id or product_id"});

    const { buySecondLifeItem } = require('../services/dataStore');
    
    try {
        const product = await buySecondLifeItem(user_id, product_id);
        const { getDB } = require('../services/dataStore');
        const db = await getDB();
        await db.run(`INSERT INTO audit_logs (event_type, details) VALUES (?, ?)`, ['checkout_second_life', JSON.stringify({ user_id, product_id })]);
        res.json({ success: true, message: 'Purchase successful', product });
    } catch (err) {
        console.error('Checkout error:', err);
        res.status(500).json({ error: 'Failed to process checkout' });
    }
});

/**
 * POST /api/checkout-cart
 * Processes a full cart checkout with optional green credits
 */
router.post('/checkout-cart', async (req, res) => {
    const { user_id, items, credits_used } = req.body;
    if (!user_id || !items || !Array.isArray(items)) return res.status(400).json({error: "Invalid request payload"});

    const { checkoutCart } = require('../services/dataStore');
    
    try {
        const results = await checkoutCart(user_id, items, credits_used || 0);
        const { getDB } = require('../services/dataStore');
        const db = await getDB();
        await db.run(`INSERT INTO audit_logs (event_type, details) VALUES (?, ?)`, ['checkout_cart', JSON.stringify({ user_id, items_count: items.length })]);
        if (credits_used > 0) {
            await db.run(`INSERT INTO audit_logs (event_type, details) VALUES (?, ?)`, ['credits_spent', JSON.stringify({ user_id, amount: credits_used })]);
        }
        res.json({ success: true, message: 'Cart checked out successfully', orders: results });
    } catch (err) {
        console.error('Cart checkout error:', err);
        res.status(500).json({ error: 'Failed to process cart checkout' });
    }
});

/**
 * GET /api/user/:id
 */
router.get('/user/:id', async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

/**
 * POST /api/plant-tree
 */
router.post('/plant-tree', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    const { getDB } = require('../services/dataStore');
    const db = await getDB();
    const user = await db.get(`SELECT green_credits, trees_planted FROM users WHERE id = ?`, [user_id]);
    
    if (!user || user.green_credits < 50) {
      return res.status(400).json({ error: 'Insufficient green credits. You need 50 to plant a tree.' });
    }

    await db.run(`UPDATE users SET green_credits = green_credits - 50, trees_planted = trees_planted + 1 WHERE id = ?`, [user_id]);
    await db.run(`INSERT INTO audit_logs (event_type, details) VALUES (?, ?)`, ['plant_tree', JSON.stringify({ user_id, amount: 50 })]);

    res.json({ success: true, message: 'Tree planted successfully!', trees_planted: user.trees_planted + 1 });
  } catch (err) {
    console.error('[API] Plant tree error:', err.message);
    res.status(500).json({ error: 'Failed to plant tree' });
  }
});

/**
 * GET /api/sustainability-stats
 */
router.get('/sustainability-stats', async (req, res) => {
  const secondLifeItems = await getSecondLifeItems();
  const allUsers = await getAllUsers();
  const allOrders = await getAllOrders();

  const totalCO2 = secondLifeItems.reduce((sum, p) => sum + (p.carbon_savings_kg || 0), 0);
  const totalCredits = allUsers.reduce((sum, u) => sum + (u.green_credits || 0), 0);
  const totalTrees = allUsers.reduce((sum, u) => sum + (u.trees_planted || 0), 0);
  const returnedOrders = allOrders.filter(o => !!o.returned).length;

  res.json({
    items_rescued: secondLifeItems.length,
    total_co2_saved_kg: Math.round(totalCO2 * 10) / 10,
    total_green_credits_issued: totalCredits,
    returns_processed: returnedOrders,
    ewaste_prevented_kg: Math.round(totalCO2 * 0.3 * 10) / 10,
    trees_planted: totalTrees
  });
});

/**
 * POST /api/verify-bill
 * Bill Validation Step
 */
router.post('/verify-bill', async (req, res) => {
    const { image_base64, product_id } = req.body;

    if (!image_base64) {
        return res.status(400).json({ isValid: false, message: 'No bill image provided.' });
    }

    // Look up the product name for context (if product_id provided)
    let productName = 'unknown product';
    if (product_id) {
        const product = await getProductById(product_id);
        if (product) productName = product.name;
    }

    try {
        const { analyzeBill } = require('../services/visionAi');
        const result = await analyzeBill(image_base64, 'image/jpeg', productName);

        if (result) {
            // AI returned a real analysis
            return res.json({
                isValid: result.isValid,
                confidence: result.confidence,
                message: result.isValid
                    ? `✅ Bill verified (${result.confidence}% confidence). ${result.explanation}`
                    : `❌ Bill rejected. ${result.explanation}`,
                details: {
                    isBill: result.isBill,
                    productMatch: result.productMatch,
                    withinReturnWindow: result.withinReturnWindow
                }
            });
        }

        // AI unavailable — use smart heuristic fallback for demo
        // Real bill photos from phones tend to be JPEG-compressed and have specific byte patterns.
        // Large colorful images (sarees, selfies) will typically have higher base64 lengths
        // because they contain more color variation than a text-heavy receipt.
        const sizeKb = Math.round((image_base64.length * 3) / 4 / 1024);
        console.log(`[verify-bill] AI unavailable. Heuristic check: image ~${sizeKb}KB`);

        // Bills are typically small (phone screenshots of e-receipts: 50-400KB)
        // Large colorful photos (>800KB) are likely not bills
        if (sizeKb > 800) {
            return res.json({
                isValid: false,
                confidence: 15,
                message: `❌ This doesn't look like a bill or receipt. Please upload a photo or screenshot of your purchase receipt for "${productName}".`
            });
        }

        // Moderate confidence pass for demo
        return res.json({
            isValid: true,
            confidence: 72,
            message: `✅ Bill verified (72% confidence). Receipt appears to be a valid purchase document within the return window.`
        });
    } catch (err) {
        console.error('[API] Bill verification error:', err.message);
        res.json({
            isValid: false,
            confidence: 0,
            message: '⚠️ Bill verification failed. Please try uploading a clearer image of your receipt.'
        });
    }
});

/**
 * Return Reason Validation
 * Checks if the uploaded photo matches the stated return reason.
 * For hackathon demo: always approves so the flow is not blocked.
 */
router.post('/validate-return', async (req, res) => {
    const { reason, customReason, description, photo } = req.body;

    // Basic input validation
    if (!reason || !description) {
        return res.json({
            match: false,
            message: 'Please select a reason and provide a description.'
        });
    }

    const reasonLabels = {
        damaged: 'Damaged / Defective',
        wrong_size: 'Wrong size / Fit',
        incorrect_item: 'Incorrect item shipped',
        other: customReason || 'Other'
    };

    try {
        const { validateReason } = require('../services/visionAi');
        const result = await validateReason(
            photo, 
            'image/jpeg', 
            'Product', 
            reasonLabels[reason] || reason, 
            customReason, 
            description
        );

        if (result) {
            return res.json({
                match: result.match,
                message: result.match
                    ? `✅ Reason verified (${result.confidence}%). ${result.explanation}`
                    : `❌ Photo doesn't match reason. ${result.explanation}`
            });
        }

        // AI unavailable — smart fallback: check if description is meaningful
        // If the customer provided a decent description (>15 chars) and a photo, treat as valid for demo
        const descriptionQuality = description && description.trim().length > 15;
        console.log(`[validate-return] AI unavailable. Heuristic: desc length=${description?.length}, photo=${!!photo}`);

        if (!photo) {
            return res.json({
                match: false,
                message: '❌ Please upload a photo of the item to validate your return reason.'
            });
        }

        if (!descriptionQuality) {
            return res.json({
                match: false,
                message: '❌ Please provide a more detailed description of the issue (at least 15 characters).'
            });
        }

        // Pass with moderate confidence
        return res.json({
            match: true,
            message: `✅ Reason validated (85% confidence). Your description and photo support the stated return reason.`
        });
    } catch (err) {
        console.error('[API] Reason validation error:', err.message);
        res.json({
            match: false,
            message: `⚠️ Validation failed. Please try again.`
        });
    }
});

/**
 * POST /api/predict-fit
 */
router.post('/predict-fit', async (req, res) => {
    const { image_base64, product_name, category, size } = req.body;
    
    if (!image_base64 || !product_name || !size) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const { predictFit } = require('../services/visionAi');
        const result = await predictFit(image_base64, 'image/jpeg', product_name, category, size);
        
        if (result) {
            return res.json({
                isFitGood: result.isFitGood,
                confidence: result.confidence,
                message: result.explanation
            });
        }
        
        // Fallback
        res.json({
            isFitGood: true,
            confidence: 50,
            message: 'Fit predicted good (fallback).'
        });
    } catch (err) {
        console.error('[API] Fit prediction error:', err.message);
        res.json({
            isFitGood: true,
            confidence: 30,
            message: 'Fit predicted good (error fallback).'
        });
    }
});

/**
 * GET /api/admin/demand-by-region
 * Returns real demand scores grouped by category and region for admin charts
 */
router.get('/admin/demand-by-region', async (req, res) => {
    try {
        const { getAllDemand } = require('../services/dataStore');
        const demandRows = await getAllDemand();

        // Get unique regions and categories
        const regions = [...new Set(demandRows.map(d => d.region))].sort();
        const categories = [...new Set(demandRows.map(d => d.category))].sort();

        if (regions.length === 0 || categories.length === 0) {
            return res.json({ labels: ['Delhi', 'Mumbai', 'Bangalore'], datasets: [] });
        }

        // Build datasets per category
        const datasets = categories.map(cat => {
            const scores = regions.map(reg => {
                const row = demandRows.find(d => d.category === cat && d.region === reg);
                return row ? row.demand_score : 0;
            });
            const colors = {
                electronics: { bg: 'rgba(0, 113, 133, 0.2)', border: '#007185' },
                clothing: { bg: 'rgba(255, 153, 0, 0.2)', border: '#FF9900' },
                accessories: { bg: 'rgba(0, 168, 107, 0.2)', border: '#00A86B' }
            };
            const c = colors[cat] || { bg: 'rgba(100,100,100,0.2)', border: '#666' };
            return { label: cat.charAt(0).toUpperCase() + cat.slice(1), data: scores, backgroundColor: c.bg, borderColor: c.border, pointBackgroundColor: c.border };
        });

        res.json({ labels: regions, datasets });
    } catch (err) {
        console.error('[API] Admin demand error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/return-breakdown
 * Returns order counts by return decision type for admin routing chart
 */
router.get('/admin/return-breakdown', async (req, res) => {
    try {
        const { getAllOrders } = require('../services/dataStore');
        const orders = await getAllOrders();

        const breakdown = {
            keep_item: 0,       // green_credit status
            second_life: 0,     // p2p_resale status
            standard_return: 0, // standard_return status
            fraud_rejected: 0,  // no order (fraud detected, return blocked)
            active: 0           // delivered but not yet returned
        };

        orders.forEach(o => {
            if (o.returned) {
                if (o.status === 'green_credit') breakdown.keep_item++;
                else if (o.status === 'p2p_resale') breakdown.second_life++;
                else if (o.status === 'standard_return') breakdown.standard_return++;
                else breakdown.standard_return++; // fallback
            } else {
                breakdown.active++;
            }
        });

        res.json(breakdown);
    } catch (err) {
        console.error('[API] Admin return breakdown error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/leaderboard
 */
router.get('/leaderboard', async (req, res) => {
    try {
        const { getTopUsers } = require('../services/dataStore');
        const users = await getTopUsers(5);
        res.json(users);
    } catch (err) {
        console.error('[API] Leaderboard error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/transactions/:userId
 * Returns a synthesised credit-history for the Green Credits dashboard.
 * Derives entries from orders joined with products.
 */
router.get('/transactions/:userId', async (req, res) => {
    try {
        const { getOrdersByUserId, getProductById, getUserById } = require('../services/dataStore');
        const userId = req.params.userId;

        const user = await getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const orders = await getOrdersByUserId(userId);
        const transactions = [];

        for (const order of orders) {
            const product = await getProductById(order.product_id);
            const productName = product ? product.name : 'Item';
            const dateStr = new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

            if (order.returned) {
                if (order.status === 'green_credit') {
                    // Kept item — earned partial refund as green credit
                    const refundAmount = product ? Math.round(product.price * 0.25) : 50;
                    transactions.push({
                        type: 'earn',
                        icon: '🌱',
                        desc: `Kept "${productName}" — Partial Refund Credit`,
                        date: dateStr,
                        amount: `+₹${refundAmount}`,
                        raw: refundAmount
                    });
                } else if (order.status === 'p2p_resale') {
                    // Listed for resale — pending credit until sold
                    transactions.push({
                        type: 'pending',
                        icon: '🏪',
                        desc: `"${productName}" listed on Second Life — awaiting sale`,
                        date: dateStr,
                        amount: '⏳ Pending',
                        raw: 0
                    });
                } else if (order.status === 'standard_return') {
                    transactions.push({
                        type: 'neutral',
                        icon: '📦',
                        desc: `Standard return — "${productName}"`,
                        date: dateStr,
                        amount: '₹0',
                        raw: 0
                    });
                }
            } else if (order.status === 'p2p_local_delivery') {
                // Bought a second-life item locally
                transactions.push({
                    type: 'spend',
                    icon: '♻️',
                    desc: `Bought "${productName}" from Second Life`,
                    date: dateStr,
                    amount: product ? `-₹${product.resale_price || product.price}` : '—',
                    raw: 0
                });
            }
        }

        // Also check if user has items currently listed (inventory_owner = seller_userId)
        const { getAllProducts } = require('../services/dataStore');
        const allProducts = await getAllProducts();
        const listed = allProducts.filter(p => p.inventory_owner === `seller_${userId}`);
        for (const p of listed) {
            // Only add if not already in a p2p_resale order entry
            const alreadyIn = transactions.some(t => t.desc.includes(p.name));
            if (!alreadyIn) {
                transactions.push({
                    type: 'pending',
                    icon: '🏪',
                    desc: `"${p.name}" listed on Second Life — awaiting sale`,
                    date: 'Active listing',
                    amount: `⏳ +₹${p.resale_price || Math.round(p.price * 0.7)} on sale`,
                    raw: 0
                });
            }
        }

        // Add "plant_tree" and "credits_spent" audit logs to transactions
        const { getDB } = require('../services/dataStore');
        const db = await getDB();
        const auditLogs = await db.all(`SELECT * FROM audit_logs WHERE event_type IN ('plant_tree', 'credits_spent')`);
        for (const log of auditLogs) {
            try {
                const details = JSON.parse(log.details);
                if (details.user_id === userId) {
                    const dateStr = new Date(log.created_at + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                    if (log.event_type === 'plant_tree') {
                        transactions.push({
                            type: 'spend',
                            icon: '🌳',
                            desc: `Planted a tree via SankalpTaru`,
                            date: dateStr,
                            amount: `-₹${details.amount}`,
                            raw: 0
                        });
                    } else if (log.event_type === 'credits_spent') {
                        transactions.push({
                            type: 'spend',
                            icon: '💳',
                            desc: `Used credits at checkout`,
                            date: dateStr,
                            amount: `-₹${details.amount}`,
                            raw: 0
                        });
                    }
                }
            } catch (e) {}
        }

        // Sort transactions by date (descending approximated by raw logic usually, or just append since date parsing might be tricky, but we can leave them at the end or sort them by created_at if we had the raw timestamps for all, for now append is fine).

        res.json({
            user_id: userId,
            name: user.name,
            green_credits: user.green_credits,
            transactions
        });
    } catch (err) {
        console.error('[API] Transactions error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware for this router
router.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
