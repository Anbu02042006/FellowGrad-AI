package com.fellowgrad.aiservice.service;

import com.fellowgrad.aiservice.client.ElevenLabsClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TtsService {

    private final ElevenLabsClient elevenLabsClient;

    public byte[] generateSpeech(String text) {
        return elevenLabsClient.textToSpeech(text);
    }
}