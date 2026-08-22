import apiClient from './apiClient';

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  messageType: 'TEXT' | 'VOICE';
  timestamp: string;
}

export interface CreateConversationRequest {
  userId: string;
  title: string;
}

export interface SendMessageRequest {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  messageType: 'TEXT' | 'VOICE';
}

const conversationApi = {
  create: (data: CreateConversationRequest) =>
    apiClient.post<Conversation>('/api/conversations', data),

  getByUser: (userId: string) =>
    apiClient.get<Conversation[]>(`/api/conversations/user/${userId}`),

  getById: (id: string) =>
    apiClient.get<Conversation>(`/api/conversations/${id}`),

  getMessages: (conversationId: string) =>
    apiClient.get<Message[]>(`/api/conversations/${conversationId}/messages`),

  sendMessage: (conversationId: string, data: SendMessageRequest) =>
    apiClient.post<Message>(`/api/conversations/${conversationId}/messages`, data),

  getRecent: (conversationId: string, limit: number = 10) =>
    apiClient.get<Message[]>(`/api/conversations/${conversationId}/recent?limit=${limit}`),
};

export default conversationApi;
