# Amazon Second Life ♻️

> **By YJ-424-Rocket** — Built for the Amazon HackOn Competition

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini_2.5_Flash-4285F4?style=for-the-badge&logo=googlebot&logoColor=white" />
</div>

---

## 1. 🚀 PROJECT OVERVIEW & VALUE PROPOSITION

Retail returns are a **$743B problem** annually, functioning as a massive cost center and generating egregious carbon emissions through inefficient reverse logistics. Most returns end up in landfills or suffer complete margin erosion due to the exorbitant costs of shipping, inspecting, grading, and restocking.

**Amazon Second Life** transforms this linear, wasteful pipeline into a sustainable, hyper-localized circular economy. By leveraging Google Gemini 2.5-flash vision models to instantly grade item conditions at the edge (via customer-uploaded photos), our AI-powered engine dynamically routes returns to maximize margin recovery and minimize carbon footprints.

**We are not just solving returns; we are inventing a new revenue stream rooted in sustainability.**

---

## 2. 🧠 THE CORE 3-TIER ROUTING ARCHITECTURE

Our proprietary decision engine parses AI-generated Quality Scores (0-100) and immediately routes the return through one of three optimized tiers.

*   **Tier 1: High Retention (Quality Score >= 70)**
    *   **Action:** Keep item + Partial Refund in Green Credits.
    *   **Logic:** The item is in excellent condition but not worth the reverse logistics cost. The customer keeps the item and receives instant Amazon Green Credits, ensuring capital stays within the Amazon ecosystem.
*   **Tier 2: Circular Economy (Quality Score 50-69)**
    *   **Action:** Auto-list on hyper-local Peer-to-Peer Second Life Resale Marketplace.
    *   **Logic:** The item is gently used or open-box. Instead of shipping it back to an FC, it is immediately listed on a localized C2C secondary market, fulfilling demand in the same geographic radius to drastically cut transit emissions.
*   **Tier 3: End of Life (Quality Score < 50)**
    *   **Action:** Standard reverse logistics return to certified recycling streams.
    *   **Logic:** The item is heavily damaged or unsalvageable. It is routed directly to local E-waste or textile recycling partners to ensure zero-landfill compliance.

> [!WARNING]
> **Fraud Override Check:** The system executes a high-speed vector analysis comparing the uploaded return photo against the original product catalog and invoice. Mismatches instantly flag the transaction, drop the user's trust score, block the automated refund, and alert the admin dashboard for manual review.

---

## 3. 🛠️ TECH STACK & SYSTEM INFRASTRUCTURE

| Layer | Technologies Used | Purpose |
| :--- | :--- | :--- |
| **Frontend** | HTML5, Tailwind CSS, Vanilla JS, Chart.js | Highly responsive, lightweight, dependency-free UI for speed and accessibility. |
| **Backend** | Node.js, Express, Socket.io | High-throughput, non-blocking asynchronous API routing and real-time dashboard events. |
| **Database** | SQLite | Acid-compliant, zero-config relational state management for localized hackathon testing. |
| **AI / ML** | Google Gemini 2.5-flash (Vision) | Ultra-low latency multimodal image processing for grading and fraud detection. |

### AWS Production Roadmap

This local Node.js engine is architected to be instantly portable to enterprise AWS environments:

*   **S3 & CloudFront:** Customer image file uploads will stream directly to Amazon S3 Buckets, served via CloudFront for edge-optimized delivery.
*   **Serverless Compute:** Express routing logic naturally decouples into event-driven **AWS Lambda** functions behind an API Gateway, ensuring infinite scaling during peak return seasons (e.g., post-Holiday).
*   **Enterprise AI:** Image grading and invoice parsing will migrate under the secure, VPC-enclosed umbrella of **Amazon Bedrock**, utilizing Claude 3.5 Sonnet for top-tier multimodal reasoning and strict data privacy compliance.

---

## 4. 📊 MATHEMATICAL MODELS & ALGORITHMS

Our proprietary **Dynamic Market-Decay Pricing Model** ensures Tier 2 items are priced to move efficiently, abandoning rigid, static markdown strategies that lead to dead stock.

**Formula:**
`Price_resale = Price_original * max(0.20, min(0.95, (Base_grade + Demand_Score_Trend) * Volatility_Coefficient * (0.98)^age))`

*   `Base_grade`: The normalized AI Quality Score (e.g., 0.65 for a score of 65).
*   `Demand_Score_Trend`: Real-time category momentum (e.g., +0.05 for high-demand electronics).
*   `Volatility_Coefficient`: A dampening factor to prevent extreme price shocks.
*   `age`: Number of days since the item was designated for return.

**Why this wins:** By incorporating a time-decay factor (`0.98^age`), the algorithm algorithmically slashes prices on stagnant inventory, ensuring localized liquidity and clearing warehouse/customer bottlenecks automatically.

---

## 5. ⚡ LOCAL INSTALLATION & QUICK START

Follow these steps to boot the local development environment:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/amazon-second-life.git
cd amazon-second-life

# 2. Install core dependencies
npm install

# 3. Configure environment variables
# Create a .env file in the root directory
echo "PORT=3001" > .env
echo "GEMINI_API_KEY=your_gemini_api_key_here" >> .env

# 4. Boot the application
npm start
```

### 🏃 HOW TO RUN IT
After running `npm start`, the server will initialize. **Open your web browser and navigate to:**
`http://localhost:3001`

---

## 6. 🎯 COMPLIANCE, SECURITY & METRICS

While built for speed during HackOn, the architecture is designed with Amazon's rigorous production standards in mind:

*   **Security & Throttling:** Implementation of strict API rate-limiting and JWT-based route protection middleware to prevent abuse of the grading engine.
*   **Data Integrity:** Comprehensive audit logging tables tracking every state mutation from initial return request to final disposition.
*   **Sustainability Metrics:** Live analytical tracking of `E-Waste Prevented (kg)` and `Carbon Footprint Saved (kg CO2)` visible on the admin dashboard, providing verifiable ESG reporting.

*Built with Customer Obsession and Frugality by Jasmine and Yashika.*
