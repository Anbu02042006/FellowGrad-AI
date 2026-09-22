import apiClient from './apiClient';
import { UserPreferences, AcademicProfile } from './authApi';

export interface UserProfile {
  id?: string;
  userId: string;
  name: string;
  fullName?: string;
  email?: string;
  educationLevel?: string;
  college?: string;
  course?: string;
  year?: string;
  interests?: string | string[];
  careerGoals?: string | string[];
  goals?: string[];
  skills?: string;
  preferences?: UserPreferences;
  academicProfile?: AcademicProfile;
  createdAt?: string;
  updatedAt?: string;
}

const userApi = {
  // Scoped profile for authenticated user
  getMeProfile: () =>
    apiClient.get<UserProfile>('/api/users/profile'),

  updateMeProfile: (data: Partial<UserProfile>) =>
    apiClient.put<UserProfile>('/api/users/profile', data),

  // Scoped preferences
  getPreferences: () =>
    apiClient.get<{ success: boolean; preferences: UserPreferences }>('/api/users/preferences'),

  updatePreferences: (preferences: Partial<UserPreferences>) =>
    apiClient.put<{ success: boolean; preferences: UserPreferences }>('/api/users/preferences', preferences),

  // Privacy controls
  clearAllConversations: () =>
    apiClient.delete<{ success: boolean; message: string; deletedCount: number }>('/api/conversations'),

  clearAllMemories: () =>
    apiClient.delete<{ success: boolean; message: string; deletedCount: number }>('/api/memories'),

  // Legacy endpoints
  getProfile: (userId: string) =>
    apiClient.get<UserProfile>(`/api/users/${userId}/profile`),

  updateProfile: (userId: string, data: Partial<UserProfile>) =>
    apiClient.put<UserProfile>(`/api/users/${userId}/profile`, data),
};

export default userApi;
