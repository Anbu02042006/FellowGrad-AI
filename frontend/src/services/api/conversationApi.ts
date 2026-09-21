import apiClient from './apiClient';

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  lastMessage?: string;
  messageCount?: number;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  type?: 'voice' | 'text';
  messageType?: 'TEXT' | 'VOICE';
  timestamp: string;
}

export interface CreateConversationRequest {
  title?: string;
  userId?: string;
}

export interface SendMessageRequest {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  messageType?: 'TEXT' | 'VOICE';
}

const conversationApi = {
  /**
   * Get all conversations for the authenticated user
   * GET /api/conversations
   */
  getAll: () =>
    apiClient.get<Conversation[]>('/api/conversations'),

  /**
   * Create a new conversation
   * POST /api/conversations
   */
  create: (data: CreateConversationRequest = {}) =>
    apiClient.post<Conversation>('/api/conversations', data),

  /**
   * Legacy support: Get conversations by userId
   */
  getByUser: (userId: string) =>
    apiClient.get<Conversation[]>(`/api/conversations/user/${userId}`),

  /**
   * Get single conversation details
   * GET /api/conversations/:id
   */
  getById: (id: string) =>
    apiClient.get<Conversation>(`/api/conversations/${id}`),

  /**
   * Delete conversation and all its messages
   * DELETE /api/conversations/:id
   */
  delete: (id: string) =>
    apiClient.delete<{ success: boolean; conversationId: string }>(`/api/conversations/${id}`),

  /**
   * Get messages for a conversation
   * GET /api/conversations/:conversationId/messages
   */
  getMessages: (conversationId: string) =>
    apiClient.get<Message[]>(`/api/conversations/${conversationId}/messages`),

  /**
   * Send a message to a conversation
   * POST /api/conversations/:conversationId/messages
   */
  sendMessage: (conversationId: string, data: SendMessageRequest) =>
    apiClient.post<Message>(`/api/conversations/${conversationId}/messages`, data),

  /**
   * Get recent messages
   */
  getRecent: (conversationId: string, limit: number = 10) =>
    apiClient.get<Message[]>(`/api/conversations/${conversationId}/recent?limit=${limit}`),
};

export default conversationApi;
