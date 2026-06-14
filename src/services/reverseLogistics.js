/**
 * Reverse Logistics Service
 * Matches sellers to delivery routes for item collection.
 */

/**
 * Schedules pickup by matching seller's area to an available route.
 * Implements a simulated Travelling Salesperson Problem (TSP) heuristic 
 * to find the most efficient active delivery route for a reverse pickup.
 * 
 * @param {string} sellerArea - Seller's neighborhood area
 * @param {Array} deliveryRoutes - Available routes from db.json
 * @returns {Object} Pickup scheduling details and eco-savings
 */
function schedulePickup(sellerArea, deliveryRoutes) {
  // 1. Find routes that service this area or nearby zones
  // In a real TSP, we'd calculate lat/long distances. Here we simulate it.
  const nearestRoutes = deliveryRoutes
    .filter((route) => route.area === sellerArea)
    // Simulate sorting by proximity/efficiency
    .sort((a, b) => (a.active_deliveries || 0) - (b.active_deliveries || 0));

  if (nearestRoutes.length > 0) {
    // 2. Assign to the most optimal route (fewest active deliveries to ensure capacity)
    const optimalRoute = nearestRoutes[0];
    const firstWindow = optimalRoute.time_windows[0];
    
    // 3. Calculate carbon savings of combining delivery + pickup
    // Assuming a dedicated trip costs 2.5kg CO2, combining saves ~80%
    const combinedTripSavings = 2.0;

    return {
      scheduled: true,
      pickupDay: firstWindow.day,
      timeWindow: firstWindow.slot,
      driverName: optimalRoute.driver_name,
      optimizationNote: `Assigned to ${optimalRoute.driver_name}'s existing route to minimize carbon footprint.`,
      carbonSavingsKg: combinedTripSavings
    };
  }

  // Fallback if no local route is active
  return {
    scheduled: false,
    message: 'Pickup scheduling is unavailable for your area right now. Please drop off at the nearest Amazon Hub.',
    carbonSavingsKg: 0
  };
}

module.exports = { schedulePickup };
