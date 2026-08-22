import apiClient from './apiClient';

export interface ChatRequest {
  userId: string;
  conversationId: string;
  message: string;
}

export interface ChatResponse {
  reply: string;
}

const aiApi = {
  chat: (data: ChatRequest) =>
    apiClient.post<ChatResponse>('/api/ai/chat', data),
};

export default aiApi;
