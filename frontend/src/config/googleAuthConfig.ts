/**
 * Google Sign-In Configuration for FellowGrad AI
 *
 * Android Package Name: com.fellowgrad
 * Debug Keystore Path: frontend/android/app/debug.keystore
 * Debug SHA-1 Fingerprint:   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
 * Debug SHA-256 Fingerprint: FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
 */

export const GOOGLE_AUTH_CONFIG = {
  // Web Client ID (OAuth 2.0 Web Application client) from Google Cloud Console.
  // When configured in Cloud Console, this ID is passed to Google Play Services to obtain the OpenID Connect idToken.
  webClientId: '',
  scopes: ['profile', 'email'],
  offlineAccess: false,
};

export default GOOGLE_AUTH_CONFIG;
