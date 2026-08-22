package com.fellowgrad.voiceservice.client;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class AiClient {

    private final WebClient.Builder webClientBuilder;

    public String getAiResponse(String userId, String conversationId, String message) {
        ChatRequest request = ChatRequest.builder()
                .userId(userId)
                .conversationId(conversationId)
                .message(message)
                .build();

        ChatResponse response = webClientBuilder.build()
                .post()
                .uri("lb://ai-service/api/ai/chat")
                .body(Mono.just(request), ChatRequest.class)
                .retrieve()
                .bodyToMono(ChatResponse.class)
                .block();

        return response != null ? response.getReply() : "No response from AI service";
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class ChatRequest {
        private String userId;
        private String conversationId;
        private String message;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class ChatResponse {
        private String reply;
    }
}
