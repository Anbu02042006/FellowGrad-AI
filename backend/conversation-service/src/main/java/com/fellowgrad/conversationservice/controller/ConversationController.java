package com.fellowgrad.conversationservice.controller;

import com.fellowgrad.conversationservice.dto.*;
import com.fellowgrad.conversationservice.service.ConversationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService service;

    @PostMapping
    public ResponseEntity<ConversationResponse> createConversation(
            @Valid @RequestBody CreateConversationRequest request
    ) {
        return ResponseEntity.ok(service.createConversation(request));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ConversationResponse>> getConversationsByUser(@PathVariable String userId) {
        return ResponseEntity.ok(service.getConversationsByUser(userId));
    }

    @GetMapping("/{conversationId}")
    public ResponseEntity<ConversationResponse> getConversation(@PathVariable String conversationId) {
        return ResponseEntity.ok(service.getConversation(conversationId));
    }

    @PostMapping("/{conversationId}/messages")
    public ResponseEntity<MessageResponse> sendMessage(
            @PathVariable String conversationId,
            @Valid @RequestBody SendMessageRequest request
    ) {
        return ResponseEntity.ok(service.saveMessage(conversationId, request));
    }

    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<List<MessageResponse>> getMessages(@PathVariable String conversationId) {
        return ResponseEntity.ok(service.getMessages(conversationId));
    }

    @GetMapping("/{conversationId}/recent")
    public ResponseEntity<List<MessageResponse>> getRecentMessages(
            @PathVariable String conversationId,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(service.getRecentMessages(conversationId, limit));
    }
}
