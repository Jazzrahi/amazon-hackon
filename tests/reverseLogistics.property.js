const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { schedulePickup } = require('../src/services/reverseLogistics');

/**
 * Reverse Logistics - Property-Based Tests
 * Validates: Requirements 11.1, 11.2, 11.3, 11.5
 */
describe('Reverse Logistics - Property Tests', () => {
  // Generator for a valid delivery route
  const routeArb = fc.record({
    driver_id: fc.string({ minLength: 1, maxLength: 10 }),
    driver_name: fc.string({ minLength: 1, maxLength: 30 }),
    area: fc.string({ minLength: 1, maxLength: 30 }),
    time_windows: fc.array(
      fc.record({
        day: fc.string({ minLength: 1, maxLength: 15 }),
        slot: fc.string({ minLength: 1, maxLength: 15 }),
      }),
      { minLength: 1, maxLength: 5 }
    ),
  });

  /**
   * Property 12: Reverse Logistics Area Matching
   * For any seller area that matches at least one delivery route's area,
   * schedulePickup returns scheduled=true with pickup details.
   * Validates: Requirements 11.1, 11.2, 11.3
   */
  it('Property 12: For any matching area, returns scheduled=true with pickup details', () => {
    fc.assert(
      fc.property(
        fc.array(routeArb, { minLength: 1, maxLength: 10 }),
        (routes) => {
          // Pick the area of the first route to guarantee a match
          const sellerArea = routes[0].area;
          const result = schedulePickup(sellerArea, routes);

          assert.equal(result.scheduled, true);
          assert.ok(typeof result.pickupDay === 'string');
          assert.ok(result.pickupDay.length > 0);
          assert.ok(typeof result.timeWindow === 'string');
          assert.ok(result.timeWindow.length > 0);
          assert.ok(typeof result.driverName === 'string');
          assert.ok(result.driverName.length > 0);
        }
      )
    );
  });

  /**
   * Property 13: Reverse Logistics Unavailability
   * For any seller area that does not match any delivery route's area,
   * schedulePickup returns scheduled=false with a message.
   * Validates: Requirements 11.5
   */
  it('Property 13: For any unmatched area, returns scheduled=false with message', () => {
    fc.assert(
      fc.property(
        fc.array(routeArb, { minLength: 1, maxLength: 10 }),
        (routes) => {
          // Create an area guaranteed not to match any route
          const unmatchedArea = '__UNMATCHED__' + routes.map(r => r.area).join('_');
          const result = schedulePickup(unmatchedArea, routes);

          assert.equal(result.scheduled, false);
          assert.ok(typeof result.message === 'string');
          assert.ok(result.message.length > 0);
        }
      )
    );
  });
});
