const express = require('express');
const router = express.Router();

const { 
  getUserById, getProductById, getAllProducts, getSecondLifeItems, 
  getOrdersByUserId, updateUserCredits, markItemAsAmazonOwned, 
  getAllDemand, getAllDeliveryRoutes, getOrder, markOrderReturned, 
  updateProductResale, createOrder, getAllOrders, getAllUsers
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
  const { user_id, product_id } = req.body;

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

  // Get demand data FIRST (pricing depends on it)
  const demandData = await getAllDemand();
  const { demandScore, classification: demandClassification, confidence: demandConfidence, salesVelocity, factors: demandFactors } = getDemandScore(
    product.category,
    user.region,
    demandData
  );

  // Dynamic pricing: factors in grade + demand + category
  const { resalePrice, markdownPercent, demandAdjustment } = calculateResalePrice(
    product.price, grade, demandScore, product.category
  );




  const routingResult = routeReturn({
    qualityScore,
    grade,
    productPrice: product.price,
    trustScore: user.trust_score,
    fraudDetected
  });

  let pickupResult = null;
  if (!fraudDetected) {
    const deliveryRoutes = await getAllDeliveryRoutes();
    pickupResult = schedulePickup(user.area, deliveryRoutes);
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

  await updateProductResale(product_id, finalGrade, finalResalePrice);
  const updatedProduct = await getProductById(product_id);

  if (user_id) {
    const order = await getOrder(user_id, product_id);
    if (order) {
        await markOrderReturned(order.order_id, 'p2p_resale');
    }
  }

  res.json({
    success: true,
    message: `${product.name} is now listed on Second Life Marketplace`,
    product: updatedProduct
  });
});

/**
 * GET /api/second-life
 */
router.get('/second-life', async (req, res) => {
  const items = await getSecondLifeItems();
  const region = req.query.region;
  
  if (region) {
      // Simulate location-based filtering for hackathon:
      // Users in Delhi see some items, Mumbai sees others.
      // E.g., if product id has an even number it goes to Delhi, odd to Mumbai, etc.
      // This creates the illusion of localized P2P inventory.
      const filtered = items.filter(item => {
          const num = parseInt(item.id.replace(/[^0-9]/g, ''), 10) || 0;
          if (region === 'Delhi') return num % 2 === 0;
          if (region === 'Mumbai') return num % 2 !== 0;
          return true; // Bangalore or others see all for now
      });
      return res.json(filtered);
  }
  
  res.json(items);
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
    const order = await createOrder(orderId, user_id, product_id, orderDate, 'delivered');
    res.json(order);
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
 * GET /api/sustainability-stats
 */
router.get('/sustainability-stats', async (req, res) => {
  const secondLifeItems = await getSecondLifeItems();
  const allUsers = await getAllUsers();
  const allOrders = await getAllOrders();

  const totalCO2 = secondLifeItems.reduce((sum, p) => sum + (p.carbon_savings_kg || 0), 0);
  const totalCredits = allUsers.reduce((sum, u) => sum + (u.green_credits || 0), 0);
  const returnedOrders = allOrders.filter(o => !!o.returned).length;

  res.json({
    items_rescued: secondLifeItems.length,
    total_co2_saved_kg: Math.round(totalCO2 * 10) / 10,
    total_green_credits_issued: totalCredits,
    returns_processed: returnedOrders,
    ewaste_prevented_kg: Math.round(totalCO2 * 0.3 * 10) / 10
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

        // Fallback if AI unavailable (no API key, etc.)
        res.json({
            isValid: true,
            confidence: 50,
            message: 'Bill accepted (AI unavailable — manual review flagged).'
        });
    } catch (err) {
        console.error('[API] Bill verification error:', err.message);
        // Graceful fallback — don't block the flow
        res.json({
            isValid: true,
            confidence: 30,
            message: 'Bill accepted (verification service temporarily unavailable).'
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
        // If product_id is provided, you'd fetch the product name here. For now passing generic.
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

        // Fallback
        res.json({
            match: true,
            message: `✅ Reason validated (AI unavailable). Proceeding to analysis.`
        });
    } catch (err) {
        console.error('[API] Reason validation error:', err.message);
        res.json({
            match: true,
            message: `✅ Reason validated (fallback). Proceeding to analysis.`
        });
    }
});

// Error handling middleware for this router
router.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
