# Requirements Document

## Introduction

Second Life Commerce is a full-stack localhost prototype for the Amazon HackOn hackathon addressing the "AI-Powered Returns & Sustainable Resale" problem statement. The system provides an intelligent returns pipeline that uses AI damage detection to grade returned items, dynamically prices them for resale, predicts regional demand to route items optimally, and offers instant buy-back refunds when local demand is high. The prototype runs on Node.js/Express with an HTML/CSS/JS frontend mimicking Amazon's UI (Dark Navy, Orange, White color scheme), backed by a mock JSON database.

The demo flow covers three phases: Pre-Purchase Return Prevention (eco-alerts on product pages), Smart Return Flow (AI-powered grading and routing), and Second Life Storefront (certified refurbished marketplace with trust badges and carbon savings).

## Glossary

- **System**: The Second Life Commerce full-stack application
- **AI_Grading_Engine**: The backend module that analyzes uploaded images/videos of returned items and assigns a condition grade
- **Pricing_Engine**: The backend module that calculates automated markdown percentages based on AI condition grades
- **Demand_Predictor**: The backend module that checks local buyer demand for a product category in a given region
- **Return_Router**: The backend logic that determines the return path (Green Credit, P2P Resale, or Standard Return) based on trust score, shipping cost ratio, and item value
- **Seller_Portal**: The mobile-view interface where sellers initiate smart returns and receive offers
- **Buyer_Portal**: The desktop-view interface where buyers browse the Second Life marketplace
- **Trust_Score**: A numeric value (0-100) associated with each user indicating return behavior reliability
- **Green_Credits**: Partial refund credits offered to sellers who keep items instead of returning them
- **Grade_A**: Item condition indicating like-new with minimal cosmetic wear
- **Grade_B**: Item condition indicating moderate cosmetic wear but fully functional
- **Grade_C**: Item condition indicating significant wear or minor functional issues
- **P2P_Resale**: Peer-to-peer resale listing on the Second Life Storefront
- **Eco_Alert**: A dynamic warning element on product pages showing return statistics and sizing advice
- **Trust_Badge**: A visual indicator on Second Life listings showing the AI condition report and carbon savings
- **Reverse_Logistics**: The process of collecting returned items via existing Amazon delivery routes

## Requirements

### Requirement 1: AI Damage Detection and Grading

**User Story:** As a seller, I want to upload images or videos of my returned item, so that the system can automatically assess its condition and provide a fair grade.

#### Acceptance Criteria

1. WHEN a seller uploads between 1 and 10 images (JPEG or PNG, each no larger than 10 MB) of a returned item, THE AI_Grading_Engine SHALL accept the upload and begin condition analysis within 2 seconds of receiving the files
2. WHEN a seller uploads a single video (MP4, no larger than 50 MB, maximum duration of 60 seconds) of a returned item, THE AI_Grading_Engine SHALL accept the video upload and begin condition analysis within 2 seconds of receiving the file
3. WHEN analysis is complete, THE AI_Grading_Engine SHALL categorize the item into exactly one condition grade: Grade_A, Grade_B, or Grade_C
4. WHEN the AI_Grading_Engine assigns a grade, THE System SHALL display the assigned grade and an explanation of no more than 200 characters to the seller within the Seller_Portal within 5 seconds of analysis completion
5. IF the uploaded file is not a supported format (JPEG, PNG, or MP4), THEN THE AI_Grading_Engine SHALL reject the upload and return an error message indicating the list of accepted formats
6. IF the uploaded file exceeds the maximum allowed size (10 MB per image, 50 MB for video) or the image count exceeds 10, THEN THE AI_Grading_Engine SHALL reject the upload and return an error message indicating the applicable size or count limit
7. IF the AI_Grading_Engine fails to complete analysis within 30 seconds of upload acceptance, THEN THE System SHALL display an error message indicating that analysis could not be completed and prompt the seller to retry the upload

### Requirement 2: Dynamic Pricing Engine

**User Story:** As a marketplace operator, I want returned items to be automatically priced based on their condition grade, so that buyers receive fair discounts and sellers receive appropriate credit.

#### Acceptance Criteria

1. WHEN the AI_Grading_Engine assigns Grade_A to an item, THE Pricing_Engine SHALL apply a fixed markdown of 15% of the original price
2. WHEN the AI_Grading_Engine assigns Grade_B to an item, THE Pricing_Engine SHALL apply a fixed markdown of 30% of the original price
3. WHEN the AI_Grading_Engine assigns Grade_C to an item, THE Pricing_Engine SHALL apply a fixed markdown of 50% of the original price
4. WHEN a grade has been assigned and the original price is greater than zero, THE Pricing_Engine SHALL calculate the resale price as (original price minus markdown amount), rounded to the nearest whole INR using standard rounding (0.50 and above rounds up)
5. WHEN a resale price is calculated, THE Pricing_Engine SHALL display the original price in INR, the applied markdown percentage, and the final resale price in INR to the seller on the item listing screen
6. IF the original price is zero, negative, or not available, THEN THE Pricing_Engine SHALL reject the pricing request and indicate that the original price is invalid
7. IF the AI_Grading_Engine assigns a grade other than Grade_A, Grade_B, or Grade_C, THEN THE Pricing_Engine SHALL reject the pricing request and indicate that the grade is unrecognized

### Requirement 3: Predictive Regional Liquidation

**User Story:** As a marketplace operator, I want the system to check local buyer demand before routing items to P2P resale, so that items are sold through the most efficient channel.

#### Acceptance Criteria

1. WHEN an item is graded and priced, THE Demand_Predictor SHALL retrieve the demand score (an integer from 0 to 100) for the item's product category in the seller's region from the mock JSON data store
2. WHEN the demand score for the item's category and region is greater than or equal to 60, THE Return_Router SHALL route the item to P2P_Resale listing on the Second Life Storefront
3. WHEN the demand score for the item's category and region is below 60, THE Return_Router SHALL route the item to standard warehouse liquidation
4. THE Demand_Predictor SHALL classify demand as "high" when the demand score is greater than or equal to 60 and "low" when the demand score is below 60, and pass this classification to the Return_Router
5. WHEN the routing decision is made, THE System SHALL display the chosen route, the demand score, the demand classification, and the seller's region to the seller within the Seller_Portal
6. IF no demand score entry exists for the item's category and region combination in the data store, THEN THE Demand_Predictor SHALL default the demand classification to "low" and the Return_Router SHALL route the item to standard warehouse liquidation

### Requirement 4: Instant Buy-Back Refund

**User Story:** As a seller, I want to receive instant credit when local demand for my returned item is high, so that I do not have to wait for the item to sell.

#### Acceptance Criteria

1. WHEN the Demand_Predictor determines local demand is high for a returned item, THE System SHALL offer the seller an instant credit refund equal to 100% of the resale price calculated by the Pricing_Engine
2. WHEN an instant credit refund is offered, THE System SHALL display the credit amount, the original item price, and the markdown percentage on the offer confirmation screen within the Seller_Portal
3. WHEN the seller accepts the instant credit offer, THE System SHALL add the credit amount to the seller's Green_Credits balance within the same HTTP response cycle and display a confirmation message indicating the updated balance
4. WHEN the seller declines the instant credit offer, THE System SHALL route the item through the Return_Router for standard routing evaluation and return the seller to the order history screen
5. WHEN instant credit is issued for an item, THE System SHALL mark the item record with an inventory_owner field set to "amazon" and remove the item from the seller's active listings
6. IF the System fails to update the seller's Green_Credits balance during instant credit acceptance, THEN THE System SHALL display an error message indicating the credit was not applied and preserve the offer in its pending state for retry
7. IF the seller does not accept or decline the instant credit offer within 15 minutes, THEN THE System SHALL expire the offer and route the item through the Return_Router for standard routing evaluation

### Requirement 5: Seller Portal - Smart Return Flow

**User Story:** As a seller using a mobile device, I want to initiate a smart return from my order history, so that I can quickly scan my item and receive an instant offer.

#### Acceptance Criteria

1. THE Seller_Portal SHALL display an order history screen (orders.html) listing previous orders placed within the last 30 days that have not already been returned, showing product name, order date, price, and order ID, with a "Smart Return" button for each eligible order
2. WHEN the seller taps the "Smart Return" button, THE Seller_Portal SHALL navigate to the return flow page (return-flow.html) and display a file upload interface (simulating camera capture) that accepts JPEG, PNG, or MP4 files
3. WHEN the item scan is uploaded and grading is complete, THE Seller_Portal SHALL display an instant offer confirmation screen showing the assigned grade, credit amount, and routing decision, with Accept and Decline buttons
4. THE Seller_Portal SHALL render in a responsive mobile-optimized layout with a maximum viewport width of 480px
5. WHEN the seller taps Accept, THE System SHALL process the return according to the routing decision, confirm the action with a success message, and return the seller to the order history screen
6. WHEN the seller taps Decline, THE System SHALL cancel the smart return flow and navigate the seller back to the order history screen (orders.html)
7. WHILE the AI_Grading_Engine is processing the uploaded media, THE Seller_Portal SHALL display a loading indicator with text "Analyzing your item..."
8. IF the file upload fails or the backend returns an error, THEN THE Seller_Portal SHALL display an error message and allow the seller to retry the upload without leaving the return flow page

### Requirement 6: Buyer Portal - Second Life Storefront

**User Story:** As a buyer using a desktop browser, I want to browse a marketplace of certified refurbished goods, so that I can purchase discounted items with confidence in their condition.

#### Acceptance Criteria

1. THE Buyer_Portal SHALL display a "Second Life" marketplace page (second-life.html) listing all available refurbished items in a responsive card grid layout (3 columns on desktop, 1 column on mobile), where each card shows the product name, original price (struck through), resale price, condition grade, and carbon savings
2. THE Buyer_Portal SHALL display a Trust_Badge on each listed item as a colored badge element (green for Grade_A, yellow for Grade_B, orange for Grade_C) showing the AI condition grade label
3. THE Buyer_Portal SHALL display carbon savings metrics on each listed item in the format "Saved X kg of CO2" where X is a value from the product's environmental impact data in the mock database
4. THE Buyer_Portal SHALL render in a desktop-optimized layout with a minimum viewport width of 1024px and card widths between 280px and 360px
5. WHEN a buyer clicks on an item card, THE Buyer_Portal SHALL display a detail modal or section showing the full AI Condition Report including grade, grade explanation text, item photos, original price, resale price, and carbon savings
6. THE Buyer_Portal SHALL use the Amazon color scheme: Dark Navy (#232F3E) for headers and navigation, Orange (#FF9900) for CTAs and accents, and White (#FFFFFF) for content backgrounds
7. IF no refurbished items are available in the data store, THEN THE Buyer_Portal SHALL display a message "No items currently available. Check back soon!" in place of the card grid

### Requirement 7: Pre-Purchase Return Prevention

**User Story:** As a buyer on a product page, I want to see return statistics and sizing advice before purchasing, so that I can make an informed decision and reduce unnecessary returns.

#### Acceptance Criteria

1. WHEN the frontend fetches product data from GET /api/product/:id and the response is received successfully, THE System SHALL inject an Eco_Alert element below the "Buy Now" button on the product page (product.html)
2. THE Eco_Alert SHALL display the product's return rate as a whole-number percentage in the format "X% of customers return this item"
3. WHERE a product is in a size-dependent category (clothing), THE Eco_Alert SHALL display sizing advice referencing the specific sizing trend from product data (e.g., "This brand runs small. Consider sizing up to save packaging and carbon emissions!")
4. WHERE a product has a high_return_risk flag set to true, THE Eco_Alert SHALL render with visually differentiated styling (Orange #FF9900 background with Dark Navy #232F3E text) to distinguish it from a standard informational alert
5. THE Eco_Alert SHALL use a contrasting Orange (#FF9900) background against the page's White/Dark Navy content areas to draw buyer attention
6. IF the GET /api/product/:id request fails or returns an error, THEN THE System SHALL not display the Eco_Alert and SHALL log the error to the browser console without disrupting the product page rendering

### Requirement 8: Return Routing Logic

**User Story:** As a system operator, I want the return process to automatically route returns based on trust score, cost analysis, and item value, so that each return is handled optimally.

#### Acceptance Criteria

1. WHEN a seller initiates a return and the seller's Trust_Score is below 50, THE Return_Router SHALL immediately route the item to standard return processing without evaluating further conditions (short-circuit)
2. WHEN the seller's Trust_Score is 50 or above AND the return_shipping_cost exceeds 40% of the product price, THE Return_Router SHALL offer Green_Credits equal to 50% of the product price to the seller to keep the item
3. WHEN the seller's Trust_Score is 50 or above AND the return_shipping_cost is 40% or less of the product price, THE Return_Router SHALL evaluate the item for P2P_Resale by passing it to the Demand_Predictor
4. THE Return_Router SHALL evaluate routing conditions in strict priority order: (1) Trust_Score below 50 check, (2) shipping cost ratio above 40% check, (3) P2P_Resale eligibility via Demand_Predictor
5. WHEN the Return_Router makes a routing decision, THE System SHALL include in the JSON response the decision type ("standard_return", "green_credit", or "p2p_resale"), the rule that was applied, and the evaluated values (trust_score, shipping_ratio)
6. WHEN a P2P_Resale eligible item has a demand score below 60 from the Demand_Predictor, THE Return_Router SHALL fall back to standard warehouse liquidation instead of P2P_Resale

### Requirement 9: REST API Endpoints

**User Story:** As a frontend developer, I want well-defined REST API endpoints, so that the frontend can communicate with the backend reliably.

#### Acceptance Criteria

1. THE System SHALL expose a GET /api/product/:id endpoint that returns a JSON response with Content-Type application/json containing fields: id (string), name (string), price (integer), return_shipping_cost (integer), high_return_risk (boolean), category (string), return_rate (integer), and sizing_advice (string or null)
2. THE System SHALL expose a POST /api/process-return endpoint that accepts a JSON request body with Content-Type application/json containing fields: user_id (string, required) and product_id (string, required), and returns the routing decision with offer details
3. WHEN the GET /api/product/:id endpoint receives a valid product ID that exists in the data store, THE System SHALL return the product data in JSON format with HTTP status 200
4. IF the GET /api/product/:id endpoint receives a product ID that does not exist in the data store, THEN THE System SHALL return a JSON response with an "error" field containing "Product not found" with HTTP status 404
5. WHEN the POST /api/process-return endpoint successfully processes a return, THE System SHALL return a JSON response with HTTP status 200 containing fields: decision (string), grade (string), offer_amount (integer or null), demand_score (integer), demand_classification (string), and reasoning (string)
6. IF the POST /api/process-return endpoint receives a request body missing user_id or product_id, THEN THE System SHALL return a JSON response with an "error" field describing the missing fields with HTTP status 400
7. THE System SHALL enable CORS for all origins on all API endpoints to allow frontend fetch() calls from any localhost port

### Requirement 10: Mock Data Store

**User Story:** As a developer, I want a mock JSON database with realistic seed data, so that the prototype can demonstrate all features without requiring a real database.

#### Acceptance Criteria

1. THE System SHALL use a JSON file located at /data/db.json as the data store for users and products
2. THE System SHALL store user records containing user ID (string), Trust_Score (integer, 1 to 100), Green_Credits balance (integer, 0 to 5000 INR), name (string), and region (string)
3. THE System SHALL store product records containing product ID (string), name (string, maximum 100 characters), price (integer, 199 to 49999 INR), return_shipping_cost (integer, 50 to 500 INR), high_return_risk (boolean), category (one of: "clothing", "electronics", "accessories"), return_rate (integer, 0 to 100), and sizing_advice (string or null)
4. THE System SHALL provide seed data with at least 6 users: at least 2 users with Trust_Score below 50, at least 2 users with Trust_Score between 50 and 80, and at least 2 users with Trust_Score above 80
5. THE System SHALL provide seed data with at least 9 products: at least 3 products per category (clothing, electronics, accessories), where each category contains at least 1 product with high_return_risk set to true and at least 1 product with high_return_risk set to false
6. THE System SHALL include at least 2 products where return_shipping_cost exceeds 40% of the product price, and at least 2 products where price is above 10000 INR with high_return_risk set to false, so that all Return_Router paths are demonstrable with the seed data
7. THE System SHALL persist changes to the JSON file during runtime so that return processing operations are reflected in subsequent reads
8. THE System SHALL store regional demand data as an array of records containing category (string), region (string), and demand_score (integer, 0 to 100)

### Requirement 11: Reverse Logistics Integration

**User Story:** As a seller, I want my returned item to be collected by an Amazon driver during a scheduled neighborhood delivery, so that I do not incur any courier costs.

#### Acceptance Criteria

1. WHEN a return is routed to P2P_Resale or standard return, THE System SHALL match the seller's neighborhood area to an available mock delivery route in the JSON data store that shares the same area value
2. WHEN a matching delivery route is found, THE System SHALL schedule the item collection on that route's next available time window and associate it with the route's assigned driver
3. WHEN a collection is scheduled, THE System SHALL display the pickup details to the seller including the pickup day (e.g., "Tomorrow" or the weekday name), the time window as a 2-hour range (e.g., "2-4 PM"), and the assigned driver's name (e.g., "Pickup: Tomorrow, 2-4 PM by Driver Rajesh")
4. THE System SHALL store mock delivery route records in the JSON data store containing driver ID, driver name, neighborhood area, and one or more scheduled time windows per route
5. IF no delivery route exists matching the seller's neighborhood area, THEN THE System SHALL display a message to the seller indicating that pickup scheduling is unavailable and that the seller will be notified when a route becomes available
