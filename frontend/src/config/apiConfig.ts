import { Platform } from 'react-native';

/**
 * API Configuration for FellowGrad AI
 *
 * Production backend:
 * Cloud Run
 * https://fellowgrad-backend-hlihip5lvq-uc.a.run.app
 */

const BACKEND_PORT = 5000;

// Optional LAN IP for local physical-device development.
// Keep null because we are using Cloud Run.
const CUSTOM_LAN_IP: string | null = null;

// Production Cloud Run backend
const PRODUCTION_URL =
  'https://fellowgrad-backend-hlihip5lvq-uc.a.run.app';

export const getApiBaseUrl = (): string => {
  // Production Cloud Run
  if (PRODUCTION_URL && PRODUCTION_URL.trim().length > 0) {
    return PRODUCTION_URL.replace(/\/+$/, '');
  }

  // Physical device local development
  if (CUSTOM_LAN_IP) {
    return `http://${CUSTOM_LAN_IP}:${BACKEND_PORT}`;
  }

  // Android emulator local development
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${BACKEND_PORT}`;
  }

  // iOS simulator / Web local development
  return `http://localhost:${BACKEND_PORT}`;
};

export const getWsBaseUrl = (): string => {
  const httpUrl = getApiBaseUrl();

  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://');
  }

  return httpUrl.replace('http://', 'ws://');
};

export const getLiveWebSocketUrl = (token: string): string => {
  const wsBaseUrl = getWsBaseUrl();

  return `${wsBaseUrl}/ws/live?token=${encodeURIComponent(token)}`;
};

const API_BASE_URL = getApiBaseUrl();

export default API_BASE_URL;