# Implementation Plan: Second Life Commerce

## Overview

This plan implements a full-stack localhost prototype for an AI-Powered Returns & Sustainable Resale platform. The system uses Node.js/Express with file-based JSON persistence, serving static HTML/CSS/JS pages. Implementation proceeds from data layer → core services → API routes → frontend pages → integration wiring.

## Tasks

- [x] 1. Set up project structure and initialize dependencies
  - [x] 1.1 Initialize Node.js project and install dependencies
    - Run `npm init` and install express, cors, and fast-check (dev)
    - Create directory structure: `/src/services/`, `/src/routes/`, `/public/`, `/data/`, `/tests/`
    - Create `server.js` entry point with Express app listening on port 3000
    - Add `npm start`, `npm test`, and `npm run test:property` scripts to package.json
    - _Requirements: 9.7_

  - [x] 1.2 Create the mock JSON data store with seed data
    - Create `/data/db.json` with users (6+), products (9+), demand records, delivery_routes, and orders
    - Ensure at least 2 users with trust_score < 50, 2 between 50-80, 2 above 80
    - Ensure at least 3 products per category (clothing, electronics, accessories) with varied high_return_risk
    - Include at least 2 products where return_shipping_cost > 40% of price
    - Include regional demand records covering high and low demand scenarios
    - Include delivery_routes with driver details, areas, and time_windows
    - Include orders within last 30 days for demo users
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.8_

  - [x] 1.3 Implement the Data Access Layer (`/src/services/dataStore.js`)
    - Implement `readDB()` and `writeDB(data)` for synchronous file-based persistence
    - Implement `getUserById(userId)`, `getProductById(productId)`
    - Implement `getSecondLifeItems()` returning items with inventory_owner = "amazon"
    - Implement `getOrdersByUserId(userId)` returning orders from last 30 days
    - Implement `updateUserCredits(userId, amount)` adding amount to Green_Credits
    - Implement `markItemAsAmazonOwned(productId)` setting inventory_owner to "amazon"
    - _Requirements: 10.1, 10.7, 4.3, 4.5_

- [x] 2. Implement core backend services
  - [x] 2.1 Implement AI Grading Engine (`/src/services/gradingEngine.js`)
    - Implement `gradeItem({ imageCount, totalFileSize, fileType })` function
    - Use deterministic hash-based logic: grade A (hash%3===0), B (hash%3===1), C (hash%3===2)
    - Return `{ grade: "A"|"B"|"C", explanation: string }` with explanation ≤ 200 chars
    - Implement upload validation: reject unsupported formats (not JPEG/PNG/MP4), reject oversized files
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 2.2 Write property tests for AI Grading Engine
    - **Property 1: Grading Output Invariant** — For any valid upload params, gradeItem returns exactly one grade from {A,B,C} and explanation ≤ 200 chars
    - **Property 2: Upload Validation Rejects Invalid Formats** — For any invalid format string, validator rejects with error
    - **Validates: Requirements 1.3, 1.4, 1.5**

  - [x] 2.3 Implement Pricing Engine (`/src/services/pricingEngine.js`)
    - Implement `calculateResalePrice(originalPrice, grade)` function
    - Grade A: 15% markdown, Grade B: 30% markdown, Grade C: 50% markdown
    - Return `{ resalePrice, markdownPercent, markdownAmount }` with Math.round()
    - Throw error for price ≤ 0 or unrecognized grade
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.4 Write property tests for Pricing Engine
    - **Property 3: Pricing Calculation Correctness** — For any positive price and valid grade, resalePrice = Math.round(price × (1 - markdownRate))
    - **Property 4: Pricing Rejects Invalid Inputs** — For price ≤ 0 or invalid grade, throws error
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

  - [x] 2.5 Implement Demand Predictor (`/src/services/demandPredictor.js`)
    - Implement `getDemandScore(category, region, demandData)` function
    - Return `{ demandScore, classification: "high"|"low" }` with threshold at 60
    - Default to score 0, classification "low" when no matching entry exists
    - _Requirements: 3.1, 3.4, 3.6_

  - [x] 2.6 Write property tests for Demand Predictor
    - **Property 5: Demand Classification Threshold** — For any score 0-100, classify "high" when ≥ 60, "low" when < 60; missing entries default to 0/"low"
    - **Validates: Requirements 3.1, 3.4, 3.6**

  - [x] 2.7 Implement Return Router (`/src/services/returnRouter.js`)
    - Implement `routeReturn({ trustScore, returnShippingCost, productPrice, demandClassification })` function
    - Priority 1: trustScore < 50 → "standard_return" (short-circuit)
    - Priority 2: shippingCost/price > 0.40 → "green_credit" with offer = Math.round(price × 0.50)
    - Priority 3: demandClassification === "high" → "p2p_resale"
    - Priority 4: else → "standard_return"
    - Return decision, rule, trustScore, shippingRatio, offerAmount
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 2.8 Write property tests for Return Router
    - **Property 6: Return Routing Priority Rules** — For any combination of trustScore (0-100), shippingCost, price (positive), demandClassification, verify strict priority ordering and correct decision
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 3.2, 3.3**

  - [x] 2.9 Implement Reverse Logistics (`/src/services/reverseLogistics.js`)
    - Implement `schedulePickup(sellerArea, deliveryRoutes)` function
    - Match seller area to available route, return pickup_day, time_window, driver_name
    - Return `{ scheduled: false, message: "..." }` when no matching route
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 2.10 Write property tests for Reverse Logistics
    - **Property 12: Reverse Logistics Area Matching** — For any seller area matching a route, returns scheduled=true with pickup details
    - **Property 13: Reverse Logistics Unavailability** — For any unmatched area, returns scheduled=false with message
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.5**

- [x] 3. Checkpoint - Core services validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement API routes and server wiring
  - [x] 4.1 Implement API routes (`/src/routes/api.js`)
    - Implement `GET /api/product/:id` — return product JSON (200) or error (404)
    - Implement `POST /api/process-return` — validate body, orchestrate grading → pricing → demand → routing → logistics, return full response (200) or error (400)
    - Implement `GET /api/second-life` — return all items with inventory_owner = "amazon"
    - Implement `GET /api/orders/:userId` — return user's orders from last 30 days
    - Enable CORS for all origins on all endpoints
    - Add global error handling middleware
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 4.2 Write property tests for API endpoints
    - **Property 9: Product API Response Structure** — For any existing product ID, GET returns 200 with all required fields
    - **Property 10: Product API 404 for Missing IDs** — For any non-existent ID, GET returns 404 with error field
    - **Property 11: Process-Return API Validation** — For any request missing user_id or product_id, POST returns 400 with error
    - **Validates: Requirements 9.1, 9.3, 9.4, 9.6**

  - [x] 4.3 Write property tests for Green Credits and Data Persistence
    - **Property 7: Green Credits Balance Update** — For any user balance B and credit C, balance becomes B + C and item becomes amazon-owned
    - **Property 8: Data Persistence Round-Trip** — For any valid mutation, subsequent read reflects written values
    - **Validates: Requirements 4.1, 4.3, 4.5, 10.7**

  - [x] 4.4 Wire Express server (`server.js`)
    - Import and mount API routes
    - Serve static files from `/public/`
    - Add CORS middleware
    - Add JSON body parser
    - Add global error handler
    - Start server on port 3000
    - _Requirements: 9.7_

- [x] 5. Checkpoint - Backend API validation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement frontend pages
  - [-] 6.1 Create Product Page with Eco Alert (`public/product.html`)
    - Build product detail page with "Buy Now" button
    - Implement Eco Alert banner injection below "Buy Now" using fetch to GET /api/product/:id
    - Apply orange background (#FF9900) for high_return_risk items, light background for standard
    - Show return_rate as "X% of customers return this item"
    - Show sizing_advice for clothing category items
    - Silently fail on API error (log to console, don't disrupt page)
    - Use Amazon color scheme CSS variables
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [-] 6.2 Create Seller Portal - Order History (`public/orders.html`)
    - Build mobile-optimized layout (max-width: 480px)
    - Fetch orders from GET /api/orders/:userId
    - Display orders from last 30 days with product name, order date, price, order ID
    - Add "Smart Return" button for each eligible (delivered, not returned) order
    - Navigate to return-flow.html on button tap
    - Use Amazon color scheme
    - _Requirements: 5.1, 5.4_

  - [-] 6.3 Create Seller Portal - Return Flow (`public/return-flow.html`)
    - Build mobile-optimized layout (max-width: 480px)
    - Implement file upload interface (simulating camera capture) accepting JPEG, PNG, MP4
    - Implement processReturn() JS handler calling POST /api/process-return
    - Show loading indicator with "Analyzing your item..." text during processing
    - Render decision-specific outcome cards (P2P Resale, Green Credit, Standard Return)
    - Implement Accept/Decline buttons for green_credit offers
    - Show pickup details (day, time window, driver name) when available
    - Display error card with retry button on failure
    - _Requirements: 5.2, 5.3, 5.5, 5.6, 5.7, 5.8_

  - [x] 6.4 Create Buyer Portal - Second Life Storefront (`public/second-life.html`)
    - Build desktop-optimized layout (min-width: 1024px)
    - Fetch items from GET /api/second-life
    - Render responsive card grid (3 columns desktop, 1 column mobile, card width 280-360px)
    - Each card shows: product name, original price (struck through), resale price, condition grade, carbon savings
    - Display Trust Badge (green=Grade A, yellow=Grade B, orange=Grade C)
    - Show carbon savings as "Saved X kg of CO2"
    - Show item detail modal/section on card click with full AI Condition Report
    - Display "No items currently available. Check back soon!" when empty
    - Use Amazon color scheme: Dark Navy headers, Orange CTAs, White backgrounds
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 7. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The backend uses JavaScript (Node.js/Express) with file-based JSON persistence
- Frontend pages are vanilla HTML/CSS/JS with no framework dependencies
- All services follow the interfaces defined in the design document

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.3", "2.5", "2.7", "2.9"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.6", "2.8", "2.10"] },
    { "id": 4, "tasks": ["4.1", "4.4"] },
    { "id": 5, "tasks": ["4.2", "4.3"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3", "6.4"] }
  ]
}
```
