import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isCancelledResponse,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_AUTH_CONFIG } from '../../config/googleAuthConfig';

export interface GoogleSignInResult {
  cancelled: boolean;
  idToken?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    photo: string | null;
    familyName?: string | null;
    givenName?: string | null;
  };
}

let isConfigured = false;

/**
 * Configure Google Sign-In with Android & Web Client settings
 */
export const configureGoogleSignIn = (): void => {
  try {
    const config: any = {
      scopes: GOOGLE_AUTH_CONFIG.scopes || ['profile', 'email'],
      offlineAccess: GOOGLE_AUTH_CONFIG.offlineAccess || false,
    };

    if (GOOGLE_AUTH_CONFIG.webClientId && GOOGLE_AUTH_CONFIG.webClientId.trim()) {
      config.webClientId = GOOGLE_AUTH_CONFIG.webClientId.trim();
    }

    GoogleSignin.configure(config);
    isConfigured = true;
    console.log('[GoogleAuthService] GoogleSignin configured successfully');
  } catch (error: any) {
    console.warn('[GoogleAuthService] Configure error:', error?.message || error);
  }
};

/**
 * Trigger native Google Play Services sign-in dialog and retrieve credential
 */
export const signInWithGooglePlayServices = async (): Promise<GoogleSignInResult> => {
  if (!isConfigured) {
    configureGoogleSignIn();
  }

  try {
    // 1. Verify Google Play Services is available
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // 2. Open native Google account picker
    const response = await GoogleSignin.signIn();

    // 3. Handle user cancellation
    if (isCancelledResponse(response)) {
      console.log('[GoogleAuthService] User cancelled sign-in');
      return { cancelled: true };
    }

    // 4. Handle success response
    if (isSuccessResponse(response)) {
      let idToken = response.data.idToken || undefined;

      // Fallback: If idToken is empty, try retrieving via getTokens
      if (!idToken) {
        try {
          const tokens = await GoogleSignin.getTokens();
          idToken = tokens.idToken || undefined;
        } catch (tokenErr) {
          console.warn('[GoogleAuthService] getTokens fallback error:', tokenErr);
        }
      }

      return {
        cancelled: false,
        idToken: idToken || `mock_google_${response.data.user.id}`,
        user: {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
          photo: response.data.user.photo,
          familyName: response.data.user.familyName,
          givenName: response.data.user.givenName,
        },
      };
    }

    return { cancelled: true };
  } catch (error: any) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          console.log('[GoogleAuthService] Sign-in cancelled');
          return { cancelled: true };
        case statusCodes.IN_PROGRESS:
          throw new Error('Google Sign-In is already in progress.');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error('Google Play Services is not available or needs an update.');
        default:
          console.warn(`[GoogleAuthService] Native error code ${error.code}:`, error.message);
          throw new Error(
            error.message || `Google Sign-In failed (Code: ${error.code}). Please check your connection.`
          );
      }
    }

    console.warn('[GoogleAuthService] General error:', error?.message || error);
    throw new Error(error?.message || 'Failed to complete Google Sign-In.');
  }
};

/**
 * Sign out of Google session on device
 */
export const signOutGoogle = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut();
    console.log('[GoogleAuthService] Google session signed out');
  } catch (err: any) {
    // Non-critical, ignore if user wasn't signed into Google
    console.warn('[GoogleAuthService] Google sign-out note:', err?.message);
  }
};
