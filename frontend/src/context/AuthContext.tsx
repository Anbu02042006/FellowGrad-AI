import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authApi, {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  SafeUser,
  ChangePasswordRequest,
  UserPreferences,
} from '../services/api/authApi';
import userApi, { UserProfile } from '../services/api/userApi';
import audioInputService from '../services/audioInputService';
import audioOutputService from '../services/audioOutputService';

interface AuthContextType {
  user: SafeUser | AuthResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearAuthStorage = async (includeVoice = false) => {
  try {
    const keys = ['accessToken', 'refreshToken', 'userData'];
    if (includeVoice) keys.push('@fellowgrad_selected_voice');
    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
  } catch (_) {}
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SafeUser | AuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored session on application launch
    const loadStoredAuth = async () => {
      console.log('[AUTH] App starting');
      console.log('[AUTH] Restoring session...');

      try {
        const storedToken = await AsyncStorage.getItem('accessToken');
        const storedUser = await AsyncStorage.getItem('userData');

        if (!storedToken || !storedUser) {
          console.log('[AUTH] Session not found (unauthenticated) -> Navigating to Welcome');
          setUser(null);
          setIsLoading(false);
          return;
        }

        console.log('[AUTH] Stored credentials found, validating with backend...');
        try {
          const meRes = await authApi.getMe();
          if (meRes.data?.user) {
            console.log('[AUTH] Session verified with backend for:', meRes.data.user.email);
            setUser(meRes.data.user);
            await AsyncStorage.setItem('userData', JSON.stringify(meRes.data.user));
          } else {
            throw new Error('Invalid user payload from backend');
          }
        } catch (validateErr: any) {
          console.warn('[AUTH] Token validation failed:', validateErr.message);
          // Check if refresh token can restore the session
          const refreshToken = await AsyncStorage.getItem('refreshToken');
          if (refreshToken) {
            console.log('[AUTH] Attempting refresh token exchange...');
            try {
              const refreshRes = await authApi.refresh(refreshToken);
              if (refreshRes.data?.token && refreshRes.data?.user) {
                console.log('[AUTH] Session refreshed successfully for:', refreshRes.data.user.email);
                await AsyncStorage.setItem('accessToken', refreshRes.data.token);
                if (refreshRes.data.refreshToken) {
                  await AsyncStorage.setItem('refreshToken', refreshRes.data.refreshToken);
                }
                await AsyncStorage.setItem('userData', JSON.stringify(refreshRes.data.user));
                setUser(refreshRes.data.user);
                setIsLoading(false);
                return;
              }
            } catch (refreshErr: any) {
              console.warn('[AUTH] Refresh token failed:', refreshErr.message);
            }
          }

          // If we reach here, stored token is invalid/expired
          console.log('[AUTH] No valid session restored. Purging stale tokens -> Navigating to Welcome');
          await clearAuthStorage();
          setUser(null);
        }
      } catch (e) {
        console.error('[AUTH] Failed to load stored session:', e);
        await clearAuthStorage();
        setUser(null);
      } finally {
        setIsLoading(false);
        console.log('[AUTH] Session restoration process finished.');
      }
    };

    loadStoredAuth();
  }, []);

  const login = async (data: LoginRequest) => {
    try {
      console.log('[AUTH] Performing login for:', data.email);
      const response = await authApi.login(data);
      const authData = response.data;
      const userObj = authData.user || authData;

      await AsyncStorage.setItem('accessToken', authData.token);
      if (authData.refreshToken) {
        await AsyncStorage.setItem('refreshToken', authData.refreshToken);
      }
      await AsyncStorage.setItem('userData', JSON.stringify(userObj));

      console.log('[AUTH] Login successful for:', userObj.email);
      setUser(userObj);
    } catch (e) {
      console.error('[AUTH] Login error:', e);
      throw e;
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      console.log('[AUTH] Performing registration for:', data.email);
      const response = await authApi.register(data);
      const authData = response.data;
      const userObj = authData.user || authData;

      await AsyncStorage.setItem('accessToken', authData.token);
      if (authData.refreshToken) {
        await AsyncStorage.setItem('refreshToken', authData.refreshToken);
      }
      await AsyncStorage.setItem('userData', JSON.stringify(userObj));

      console.log('[AUTH] Registration successful for:', userObj.email);
      setUser(userObj);
    } catch (e) {
      console.error('[AUTH] Registration error:', e);
      throw e;
    }
  };

  const logout = async () => {
    console.log('[AUTH] Logging out user...');
    try {
      // 1. Terminate any active voice recording and audio playback
      await audioInputService.stopCapture().catch(() => {});
      await audioOutputService.stop().catch(() => {});

      // 2. Notify backend to invalidate session
      await authApi.logout().catch(() => {});

      // 3. Clear local storage tokens & cached state
      await clearAuthStorage();
      setUser(null);
      console.log('[AUTH] Logged out successfully -> Navigating to Welcome');
    } catch (e) {
      console.error('[AUTH] Logout error:', e);
      // Ensure state is cleared regardless of network error
      await clearAuthStorage();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const meRes = await authApi.getMe();
      if (meRes.data?.user) {
        setUser(meRes.data.user);
        await AsyncStorage.setItem('userData', JSON.stringify(meRes.data.user));
      }
    } catch (e) {
      console.warn('[AUTH] Could not refresh user:', e);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    const res = await userApi.updateMeProfile(data);
    if (res.data) {
      const updated = {
        ...(user || {}),
        ...res.data,
      } as SafeUser;
      setUser(updated);
      await AsyncStorage.setItem('userData', JSON.stringify(updated));
    }
  };

  const updatePreferences = async (preferences: Partial<UserPreferences>) => {
    const res = await userApi.updatePreferences(preferences);
    if (res.data?.preferences && user) {
      const updated = {
        ...user,
        preferences: {
          ...((user as SafeUser).preferences || {}),
          ...res.data.preferences,
        },
      } as SafeUser;
      setUser(updated);
      await AsyncStorage.setItem('userData', JSON.stringify(updated));
    }
  };

  const changePassword = async (data: ChangePasswordRequest) => {
    await authApi.changePassword(data);
  };

  const deleteAccount = async (password?: string) => {
    try {
      console.log('[AUTH] Deleting account...');
      await audioInputService.stopCapture().catch(() => {});
      await audioOutputService.stop().catch(() => {});
      await authApi.deleteAccount(password);
      await clearAuthStorage(true);
      setUser(null);
      console.log('[AUTH] Account deleted -> Navigating to Welcome');
    } catch (e) {
      throw e;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        updateProfile,
        updatePreferences,
        changePassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
