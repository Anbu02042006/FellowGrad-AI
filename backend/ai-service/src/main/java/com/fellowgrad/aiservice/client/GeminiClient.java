package com.fellowgrad.aiservice.client;

import com.fellowgrad.aiservice.dto.GeminiRequest;
import com.fellowgrad.aiservice.dto.GeminiResponse;
import com.fellowgrad.aiservice.exception.AiServiceException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
@RequiredArgsConstructor
public class GeminiClient {

    private final WebClient webClient;

    @Value("${gemini.api-key}")
    private String apiKey;

    @Value("${gemini.base-url}")
    private String baseUrl;

    @Value("${gemini.model}")
    private String model;

    public GeminiResponse generateContent(GeminiRequest request) {

        String url = baseUrl + model + ":generateContent";

        try {
            return webClient.post()
                    .uri(url)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(GeminiResponse.class)
                    .block();

        } catch (Exception e) {
            throw new AiServiceException(
                    "Failed to communicate with Gemini API", e
            );
        }
    }
}