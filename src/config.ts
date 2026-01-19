/**
 * Configuration for Asana Chrome Extension
 *
 * IMPORTANT: For local development with real credentials:
 * 1. Copy this file to config.local.ts
 * 2. Update config.local.ts with your real Asana Client ID
 * 3. config.local.ts is gitignored and won't be committed
 *
 * To get your Asana Client ID:
 * 1. Go to https://app.asana.com/0/developer-console
 * 2. Click "Create new app"
 * 3. Fill in app name and other details
 * 4. Copy the Client ID
 * 5. Add redirect URL: https://<extension-id>.chromiumapp.org/
 *    (Get extension ID from chrome://extensions after loading unpacked)
 */

// Placeholder value for CI/builds
// For local development with real credentials:
// 1. Copy this file to config.local.ts
// 2. Update config.local.ts with your real Asana Client ID
// 3. Update imports to use './config.local' (config.local.ts is gitignored)
//
// Alternatively, you can replace this value directly for development,
// just be careful not to commit your real credentials.

export const ASANA_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
