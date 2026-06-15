const turf = require('@turf/turf');

// Approximate coordinates for areas in the demo database
const AREA_COORDS = {
  "Andheri West": [72.8333, 19.1334],
  "Bandra East": [72.8400, 19.0596],
  "Connaught Place": [77.2167, 28.6315],
  "Rohini": [77.1140, 28.7366],
  "Koramangala": [77.6200, 12.9345],
  "Whitefield": [77.7499, 12.9698]
};

/**
 * Schedules pickup by matching seller's area to an available route.
 * Uses Turf.js to calculate true geospatial distance and routing.
 * 
 * @param {string} sellerArea - Seller's neighborhood area
 * @param {Array} deliveryRoutes - Available routes from db.json
 * @returns {Object} Pickup scheduling details and eco-savings
 */
function schedulePickup(sellerArea, deliveryRoutes) {
  const sellerCoords = AREA_COORDS[sellerArea];
  if (!sellerCoords) {
    return {
      scheduled: false,
      message: 'Pickup unavailable: Area coordinates not found.',
      carbonSavingsKg: 0
    };
  }

  const sellerPoint = turf.point(sellerCoords);
  let bestRoute = null;
  let minDistance = Infinity;

  // Find the nearest active delivery route
  for (const route of deliveryRoutes) {
    const routeCoords = AREA_COORDS[route.area];
    if (routeCoords) {
      const routePoint = turf.point(routeCoords);
      // Distance in kilometers
      const dist = turf.distance(sellerPoint, routePoint, { units: 'kilometers' });
      
      // If within a reasonable city radius (e.g., 20km)
      if (dist < 20 && dist < minDistance) {
        minDistance = dist;
        bestRoute = route;
      }
    }
  }

  if (bestRoute) {
    const firstWindow = bestRoute.time_windows[0];
    
    // Calculate realistic carbon savings
    // Assume a dedicated standard trip is `distance * 0.2 kg CO2/km`
    // Piggybacking on an existing route saves 80% of that cost
    // Add a minimum floor so same-area matches still show some savings
    const distForSavings = Math.max(minDistance, 5); // 5km base trip assumed
    const dedicatedTripCarbon = distForSavings * 0.2; 
    const combinedTripSavings = Number((dedicatedTripCarbon * 0.8).toFixed(1));

    return {
      scheduled: true,
      pickupDay: firstWindow.day,
      timeWindow: firstWindow.slot,
      driverName: bestRoute.driver_name,
      optimizationNote: `Assigned to ${bestRoute.driver_name}'s route (Distance: ${minDistance.toFixed(1)} km) to minimize carbon footprint.`,
      carbonSavingsKg: combinedTripSavings
    };
  }

  // Fallback if no route within 20km
  return {
    scheduled: false,
    message: 'Pickup scheduling is unavailable. No active delivery routes within 20km. Please drop off at the nearest Amazon Hub.',
    carbonSavingsKg: 0
  };
}

module.exports = { schedulePickup };
