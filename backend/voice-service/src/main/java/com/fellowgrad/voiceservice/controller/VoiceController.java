package com.fellowgrad.voiceservice.controller;

import com.fellowgrad.voiceservice.dto.SpeechToTextResponse;
import com.fellowgrad.voiceservice.dto.TextToSpeechRequest;
import com.fellowgrad.voiceservice.service.VoiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/voice")
@RequiredArgsConstructor
public class VoiceController {

    private final VoiceService service;

    @PostMapping(value = "/speech-to-text", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<SpeechToTextResponse> speechToText(@RequestBody byte[] audioData) {
        if (audioData == null || audioData.length == 0) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(service.speechToText(audioData));
    }

    @PostMapping(value = "/text-to-speech", produces = "audio/mpeg")
    public ResponseEntity<byte[]> textToSpeech(@Valid @RequestBody TextToSpeechRequest request) {
        byte[] audio = service.textToSpeech(request);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("audio/mpeg"));
        headers.setContentLength(audio.length);
        return new ResponseEntity<>(audio, headers, HttpStatus.OK);
    }

    /**
     * Full Voice Assistant Interaction
     * Receives audio, transcribes, gets AI response, and returns response audio.
     */
    @PostMapping(value = "/process", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE, produces = "audio/mpeg")
    public ResponseEntity<byte[]> processVoice(
            @RequestBody byte[] audioData,
            @RequestParam String userId,
            @RequestParam String conversationId
    ) {
        if (audioData == null || audioData.length == 0) {
            return ResponseEntity.badRequest().build();
        }
        
        byte[] responseAudio = service.processVoiceInteraction(audioData, userId, conversationId);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("audio/mpeg"));
        headers.setContentLength(responseAudio.length);
        return new ResponseEntity<>(responseAudio, headers, HttpStatus.OK);
    }
}
