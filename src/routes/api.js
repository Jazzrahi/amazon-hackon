const express = require('express');
const router = express.Router();

const { getUserById, getProductById, getAllProducts, getSecondLifeItems, getOrdersByUserId, readDB, updateUserCredits, markItemAsAmazonOwned, writeDB } = require('../services/dataStore');
const { gradeItem } = require('../services/gradingEngine');
const { calculateResalePrice } = require('../services/pricingEngine');
const { getDemandScore } = require('../services/demandPredictor');
const { routeReturn } = require('../services/returnRouter');
const { schedulePickup } = require('../services/reverseLogistics');

/**
 * GET /api/products
 * Returns all products (200)
 */
router.get('/products', (req, res) => {
  res.json(getAllProducts());
});

/**
 * GET /api/product/:id
 * Returns product JSON (200) or error (404)
 */
router.get('/product/:id', (req, res) => {
  const product = getProductById(req.params.id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(product);
});

/**
 * POST /api/process-return
 * Orchestrates: grading → pricing → demand → routing → logistics
 * Returns full response (200) or error (400)
 */
router.post('/process-return', async (req, res) => {
  const { user_id, product_id } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!user_id) missingFields.push('user_id');
  if (!product_id) missingFields.push('product_id');

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missingFields.join(', ')}`
    });
  }

  // Get user
  const user = getUserById(user_id);
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  // Get product
  const product = getProductById(product_id);
  if (!product) {
    return res.status(400).json({ error: 'Product not found' });
  }

  // Step 1: Grade the item (real Vision AI if image provided, else mock)
  let grade = 'B';
  let explanation = 'Assessed via basic algorithms.';
  let fraudDetected = false;

  if (req.body.image_base64) {
    const { analyzeImage } = require('../services/visionAi');
    const aiResult = await analyzeImage(
      req.body.image_base64, 
      req.body.image_mime || 'image/jpeg', 
      product.category, 
      product.name
    );
    
    if (aiResult) {
      grade = aiResult.grade;
      explanation = aiResult.explanation;
      if (!aiResult.isValid) {
        fraudDetected = true;
        explanation = "FRAUD DETECTED: The uploaded image does not match the expected product. " + explanation;
        // If fraud is detected, force trust score to 0 to trigger a standard return/manual inspection.
        user.trust_score = 0; 
      }
    } else {
      // Fallback if AI fails or no API key
      const mockGrade = gradeItem({ imageCount: 1, totalFileSize: 1000000, fileType: 'image' });
      grade = mockGrade.grade;
      explanation = mockGrade.explanation;
    }
  } else {
    // Legacy mock grading
    const mockGrade = gradeItem({ imageCount: 3, totalFileSize: 2000000, fileType: 'image' });
    grade = mockGrade.grade;
    explanation = mockGrade.explanation;
  }

  // Step 2: Calculate resale price
  const { resalePrice, markdownPercent } = calculateResalePrice(product.price, grade);

  // Step 3: Get demand score
  const db = readDB();
  const { demandScore, classification: demandClassification } = getDemandScore(
    product.category,
    user.region,
    db.demand
  );

  // Step 4: Route the return (with new params for donate/recycle/exchange)
  const routingResult = routeReturn({
    trustScore: user.trust_score,
    returnShippingCost: product.return_shipping_cost,
    productPrice: product.price,
    demandClassification,
    grade,
    category: product.category,
    highReturnRisk: product.high_return_risk
  });

  if (fraudDetected) {
    routingResult.decision = 'fraud_rejected';
    routingResult.rule = 'Fraud Detected by AI Vision';
  }

  // Step 5: Schedule pickup
  const pickupResult = schedulePickup(user.area, db.delivery_routes);

  // Build response
  const response = {
    decision: routingResult.decision,
    grade,
    grade_explanation: explanation,
    offer_amount: routingResult.offerAmount,
    demand_score: demandScore,
    demand_classification: demandClassification,
    reasoning: `Rule applied: ${routingResult.rule}. Trust score: ${routingResult.trustScore}, Shipping ratio: ${routingResult.shippingRatio}`,
    resale_price: resalePrice,
    markdown_percent: markdownPercent,
    product_name: product.name,
    product_price: product.price,
    category: product.category,
    carbon_savings_kg: product.carbon_savings_kg,
    pickup: {
      scheduled: pickupResult.scheduled,
      pickup_day: pickupResult.pickupDay || null,
      time_window: pickupResult.timeWindow || null,
      driver_name: pickupResult.driverName || null
    }
  };

  res.json(response);
});

/**
 * POST /api/accept-green-credit
 * Credits the user's green_credits balance and marks order as resolved
 */
router.post('/accept-green-credit', (req, res) => {
  const { user_id, product_id, amount } = req.body;

  if (!user_id || !amount) {
    return res.status(400).json({ error: 'Missing user_id or amount' });
  }

  const updatedUser = updateUserCredits(user_id, amount);
  if (!updatedUser) {
    return res.status(400).json({ error: 'User not found' });
  }

  // Mark the order as returned
  if (product_id) {
    const db = readDB();
    const order = db.orders.find(o => o.user_id === user_id && o.product_id === product_id);
    if (order) {
      order.returned = true;
      order.return_type = 'green_credit';
      writeDB(db);
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
 * Changes product ownership to amazon, sets grade and resale price
 */
router.post('/list-for-resale', (req, res) => {
  const { user_id, product_id, grade, resale_price } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: 'Missing product_id' });
  }

  const db = readDB();
  const product = db.products.find(p => p.id === product_id);
  if (!product) {
    return res.status(400).json({ error: 'Product not found' });
  }

  product.inventory_owner = 'amazon';
  product.graded = true;
  product.grade = grade || 'B';
  product.resale_price = resale_price || Math.round(product.price * 0.7);

  // Mark the order as returned
  if (user_id) {
    const order = db.orders.find(o => o.user_id === user_id && o.product_id === product_id);
    if (order) {
      order.returned = true;
      order.return_type = 'p2p_resale';
    }
  }

  writeDB(db);

  res.json({
    success: true,
    message: `${product.name} is now listed on Second Life Marketplace`,
    product
  });
});

/**
 * GET /api/second-life
 * Returns all items with inventory_owner = "amazon"
 */
router.get('/second-life', (req, res) => {
  const items = getSecondLifeItems();
  res.json(items);
});

/**
 * GET /api/orders/:userId
 * Returns user's orders from last 30 days
 */
router.get('/orders/:userId', (req, res) => {
  const orders = getOrdersByUserId(req.params.userId);
  res.json(orders);
});

/**
 * GET /api/user/:id
 * Returns user details including green credits balance
 */
router.get('/user/:id', (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

/**
 * GET /api/sustainability-stats
 * Returns aggregated impact statistics
 */
router.get('/sustainability-stats', (req, res) => {
  const db = readDB();
  const secondLifeItems = db.products.filter(p => p.inventory_owner === 'amazon');
  const totalCO2 = secondLifeItems.reduce((sum, p) => sum + (p.carbon_savings_kg || 0), 0);
  const totalCredits = db.users.reduce((sum, u) => sum + (u.green_credits || 0), 0);
  const returnedOrders = db.orders.filter(o => o.returned === true).length;

  res.json({
    items_rescued: secondLifeItems.length,
    total_co2_saved_kg: Math.round(totalCO2 * 10) / 10,
    total_green_credits_issued: totalCredits,
    returns_processed: returnedOrders,
    ewaste_prevented_kg: Math.round(totalCO2 * 0.3 * 10) / 10
  });
});

// Error handling middleware for this router
router.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
