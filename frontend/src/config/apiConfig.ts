import { Platform } from 'react-native';

/**
 * API Configuration for FellowGrad AI
 *
 * Development Host Mapping:
 * - Android Emulator: 10.0.2.2 points to host machine's localhost
 * - iOS Simulator / Web: localhost points to host machine
 * - Physical Device: Set CUSTOM_LAN_IP to development machine's local IP (e.g. 192.168.x.x)
 * - Production: Set PRODUCTION_URL (e.g. https://<cloud-run-service-url>)
 */

// Port for Node.js Express backend
const BACKEND_PORT = 5000;

// Set to physical phone LAN IP if testing on device over Wi-Fi
const CUSTOM_LAN_IP: string | null = null; // e.g. '192.168.1.100'

// Production Cloud Run URL (set when deploying to production)
const PRODUCTION_URL = '' as string; // e.g. 'https://fellowgrad-backend-xyz.run.app'

export const getApiBaseUrl = (): string => {
  if (PRODUCTION_URL && PRODUCTION_URL.trim().length > 0) {
    return PRODUCTION_URL.replace(/\/+$/, '');
  }

  if (CUSTOM_LAN_IP) {
    return `http://${CUSTOM_LAN_IP}:${BACKEND_PORT}`;
  }

  if (Platform.OS === 'android') {
    // Android emulator special alias to 127.0.0.1 on the host computer
    return `http://10.0.2.2:${BACKEND_PORT}`;
  }

  // iOS simulator or Web
  return `http://localhost:${BACKEND_PORT}`;
};

export const getWsBaseUrl = (): string => {
  const httpUrl = getApiBaseUrl();
  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://');
  }
  return httpUrl.replace('http://', 'ws://');
};

const API_BASE_URL = getApiBaseUrl();

export default API_BASE_URL;
