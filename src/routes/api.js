const express = require('express');
const router = express.Router();

const { getUserById, getProductById, getSecondLifeItems, getOrdersByUserId, readDB } = require('../services/dataStore');
const { gradeItem } = require('../services/gradingEngine');
const { calculateResalePrice } = require('../services/pricingEngine');
const { getDemandScore } = require('../services/demandPredictor');
const { routeReturn } = require('../services/returnRouter');
const { schedulePickup } = require('../services/reverseLogistics');

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
router.post('/process-return', (req, res) => {
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

  // Step 1: Grade the item (simulated upload)
  const { grade, explanation } = gradeItem({
    imageCount: 3,
    totalFileSize: 2000000,
    fileType: 'image'
  });

  // Step 2: Calculate resale price
  const { resalePrice, markdownPercent } = calculateResalePrice(product.price, grade);

  // Step 3: Get demand score
  const db = readDB();
  const { demandScore, classification: demandClassification } = getDemandScore(
    product.category,
    user.region,
    db.demand
  );

  // Step 4: Route the return
  const routingResult = routeReturn({
    trustScore: user.trust_score,
    returnShippingCost: product.return_shipping_cost,
    productPrice: product.price,
    demandClassification
  });

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

// Error handling middleware for this router
router.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
