import apiClient from './apiClient';

export interface UserPreferences {
  theme?: 'dark' | 'light' | 'system';
  language?: 'en' | 'ta' | 'tanglish' | string;
  voice?: 'Aoede' | 'Puck' | 'Charon' | 'Kore' | string;
  memoryEnabled?: boolean;
  notificationsEnabled?: boolean;
}

export interface AcademicProfile {
  college?: string;
  course?: string;
  year?: string;
  interests?: string[];
  goals?: string[];
}

export interface SafeUser {
  id: string;
  userId: string;
  fullName: string;
  name: string;
  email: string;
  profileImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  preferences: UserPreferences;
  academicProfile: AcademicProfile;
}

export interface RegisterRequest {
  fullName?: string;
  name?: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  userId: string;
  id?: string;
  name: string;
  fullName?: string;
  email: string;
  preferences?: UserPreferences;
  academicProfile?: AcademicProfile;
  user?: SafeUser;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword?: string;
}

const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<AuthResponse>('/api/auth/register', data),

  login: (data: LoginRequest) =>
    apiClient.post<AuthResponse>('/api/auth/login', data),

  logout: () =>
    apiClient.post<{ success: boolean; message: string }>('/api/auth/logout'),

  refresh: (refreshToken: string) =>
    apiClient.post<{ token: string; refreshToken: string; user: SafeUser }>('/api/auth/refresh', { refreshToken }),

  getMe: () =>
    apiClient.get<{ success: boolean; user: SafeUser }>('/api/auth/me'),

  changePassword: (data: ChangePasswordRequest) =>
    apiClient.post<{ success: boolean; message: string }>('/api/auth/change-password', data),

  deleteAccount: (password?: string) =>
    apiClient.delete<{ success: boolean; message: string }>('/api/auth/account', { data: { password } }),

  forgotPassword: (email: string) =>
    apiClient.post<{ success: boolean; message: string }>('/api/auth/forgot-password', { email }),

  validate: (token: string) =>
    apiClient.get<boolean>(`/api/auth/validate?token=${token}`),
};

export default authApi;
