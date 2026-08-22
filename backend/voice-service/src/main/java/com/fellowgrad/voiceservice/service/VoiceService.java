package com.fellowgrad.voiceservice.service;

import com.fellowgrad.voiceservice.client.AiClient;
import com.fellowgrad.voiceservice.dto.SpeechToTextResponse;
import com.fellowgrad.voiceservice.dto.TextToSpeechRequest;
import com.fellowgrad.voiceservice.provider.SpeechToTextProvider;
import com.fellowgrad.voiceservice.provider.TextToSpeechProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class VoiceService {

    private final Optional<SpeechToTextProvider> sttProvider;
    private final Optional<TextToSpeechProvider> ttsProvider;
    private final AiClient aiClient;

    public SpeechToTextResponse speechToText(byte[] audioData) {
        if (sttProvider.isEmpty()) {
            throw new RuntimeException("Speech-to-text provider not configured");
        }
        String text = sttProvider.get().convert(audioData);
        return SpeechToTextResponse.builder().text(text).build();
    }

    public byte[] textToSpeech(TextToSpeechRequest request) {
        if (ttsProvider.isEmpty()) {
            throw new RuntimeException("Text-to-speech provider not configured");
        }
        return ttsProvider.get().convert(request.getText());
    }

    public byte[] processVoiceInteraction(byte[] audioData, String userId, String conversationId) {
        log.info("Starting voice interaction for user: {}, conversation: {}", userId, conversationId);

        // 1. Audio to Text
        String userText = speechToText(audioData).getText();
        log.info("User said: {}", userText);

        // 2. Get AI Response
        String aiResponseText = aiClient.getAiResponse(userId, conversationId, userText);
        log.info("AI response: {}", aiResponseText);

        // 3. Text to Audio
        byte[] responseAudio = textToSpeech(new TextToSpeechRequest(aiResponseText));
        log.info("Voice interaction complete, returning audio ({} bytes)", responseAudio.length);

        return responseAudio;
    }
}
