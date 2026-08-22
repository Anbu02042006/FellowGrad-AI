import apiClient from './apiClient';

export interface UserProfile {
  id?: string;
  userId: string;
  name: string;
  educationLevel?: string;
  college?: string;
  course?: string;
  interests?: string;
  careerGoals?: string;
  skills?: string;
  createdAt?: string;
  updatedAt?: string;
}

const userApi = {
  getProfile: (userId: string) =>
    apiClient.get<UserProfile>(`/api/users/${userId}/profile`),

  updateProfile: (userId: string, data: Partial<UserProfile>) =>
    apiClient.put<UserProfile>(`/api/users/${userId}/profile`, data),
};

export default userApi;
