/**
 * Delivery service radius — mirrors SERVICE_RADIUS_KM in the backend (utils/sellerGeo.js).
 * Used for labels only: the backend decides which sellers are shown and rejects orders
 * beyond the radius, so the app never sends its own radius.
 */
export const SERVICE_RADIUS_KM = 12;
