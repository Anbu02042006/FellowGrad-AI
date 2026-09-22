/**
 * Production API & WebSocket Configuration for FellowGrad AI
 *
 * Direct connection to Google Cloud Run:
 * - REST API: https://fellowgrad-backend-hlihip5lvq-uc.a.run.app
 * - Gemini Live WebSocket: wss://fellowgrad-backend-hlihip5lvq-uc.a.run.app/ws/live
 *
 * Standalone Release Build: Completely independent from USB, PC, or Metro.
 */

// Production Google Cloud Run backend
const PRODUCTION_URL = 'https://fellowgrad-backend-hlihip5lvq-uc.a.run.app';

/**
 * Returns the HTTPS REST API Base URL
 */
export const getApiBaseUrl = (): string => {
  return PRODUCTION_URL.replace(/\/+$/, '');
};

/**
 * Returns the WSS WebSocket Base URL
 */
export const getWsBaseUrl = (): string => {
  const httpUrl = getApiBaseUrl();

  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://');
  }

  return httpUrl.replace('http://', 'ws://');
};

/**
 * Returns the complete secure Gemini Live WebSocket endpoint URL
 * Path: /ws/live
 */
export const getLiveWebSocketUrl = (token: string): string => {
  const wsBaseUrl = getWsBaseUrl();
  return `${wsBaseUrl}/ws/live?token=${encodeURIComponent(token)}`;
};

const API_BASE_URL = getApiBaseUrl();

export default API_BASE_URL;