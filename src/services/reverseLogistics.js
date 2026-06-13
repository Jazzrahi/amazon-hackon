/**
 * Reverse Logistics Service
 * Matches sellers to delivery routes for item collection.
 */

/**
 * Schedules pickup by matching seller's area to an available route.
 * @param {string} sellerArea - Seller's neighborhood area
 * @param {Array} deliveryRoutes - Available routes from db.json
 * @returns {{scheduled: boolean, pickupDay: string, timeWindow: string, driverName: string} | {scheduled: false, message: string}}
 */
function schedulePickup(sellerArea, deliveryRoutes) {
  const matchingRoute = deliveryRoutes.find(
    (route) => route.area === sellerArea
  );

  if (matchingRoute) {
    const firstWindow = matchingRoute.time_windows[0];
    return {
      scheduled: true,
      pickupDay: firstWindow.day,
      timeWindow: firstWindow.slot,
      driverName: matchingRoute.driver_name,
    };
  }

  return {
    scheduled: false,
    message:
      'Pickup scheduling is unavailable for your area. You will be notified when a route becomes available.',
  };
}

module.exports = { schedulePickup };
