// Copy this file to local.config.js and fill in your values.
// local.config.js is gitignored and never committed.
module.exports = {
  // Wargaming application ID — create one at https://developers.wargaming.net/
  // Use "Mobile" type so it works from the browser (no IP restriction).
  // Or use any type and let the server proxy inject it (more secure).
  WOWS_APP_ID: '',

  // Google Analytics measurement ID (optional)
  GA_MEASUREMENT_ID: '',

  // Base path if hosted in a subdirectory (e.g. '/WoWSShipPicker'). Leave empty for root.
  WG_BASE_PATH: '',

  // Full public base URL for the WG OAuth callback.
  // For local dev: 'http://localhost:3000'
  // For production: 'https://yourdomain.com'
  WG_CALLBACK_BASE: 'http://localhost:3000',
};
