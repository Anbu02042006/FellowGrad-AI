package com.fellowgrad.aiservice.controller;

import com.fellowgrad.aiservice.dto.ChatRequest;
import com.fellowgrad.aiservice.dto.ChatResponse;
import com.fellowgrad.aiservice.dto.TtsRequest;
import com.fellowgrad.aiservice.service.AiService;
import com.fellowgrad.aiservice.service.TtsService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService service;
    private final TtsService ttsService;

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(
            @Valid @RequestBody ChatRequest request) {

        return ResponseEntity.ok(
                service.processChat(request)
        );
    }

    @PostMapping(
            value = "/tts",
            produces = "audio/mpeg"
    )
    public ResponseEntity<byte[]> textToSpeech(
            @Valid @RequestBody TtsRequest request) {

        byte[] audio =
                ttsService.generateSpeech(request.getText());

        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("audio/mpeg"))
                .body(audio);
    }
}