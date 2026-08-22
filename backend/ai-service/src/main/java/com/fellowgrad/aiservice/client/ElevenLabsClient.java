package com.fellowgrad.aiservice.client;

import com.fellowgrad.aiservice.exception.AiServiceException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
@RequiredArgsConstructor
public class ElevenLabsClient {

    private final WebClient webClient;

    @Value("${elevenlabs.api-key}")
    private String apiKey;

    @Value("${elevenlabs.voice-id}")
    private String voiceId;

    @Value("${elevenlabs.model-id}")
    private String modelId;

    public byte[] textToSpeech(String text) {

        String url =
                "https://api.elevenlabs.io/v1/text-to-speech/"
                        + voiceId
                        + "?output_format=mp3_22050_32";

        try {

            ElevenLabsRequest request =
                    new ElevenLabsRequest(text, modelId);

            return webClient
                    .post()
                    .uri(url)
                    .header("xi-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.valueOf("audio/mpeg"))
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .block();

        } catch (Exception e) {

            throw new AiServiceException(
                    "Failed to communicate with ElevenLabs API",
                    e
            );
        }
    }

    private record ElevenLabsRequest(
            String text,
            String model_id
    ) {
    }
}