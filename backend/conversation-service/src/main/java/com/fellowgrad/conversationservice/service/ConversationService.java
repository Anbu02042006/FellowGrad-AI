package com.fellowgrad.conversationservice.service;

import com.fellowgrad.conversationservice.dto.*;
import com.fellowgrad.conversationservice.model.Conversation;
import com.fellowgrad.conversationservice.model.Message;
import com.fellowgrad.conversationservice.repository.ConversationRepository;
import com.fellowgrad.conversationservice.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    public ConversationResponse createConversation(CreateConversationRequest request) {
        Conversation conversation = Conversation.builder()
                .userId(request.getUserId())
                .title(request.getTitle())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        
        Conversation saved = conversationRepository.save(conversation);
        return mapToConversationResponse(saved);
    }

    public List<ConversationResponse> getConversationsByUser(String userId) {
        return conversationRepository.findByUserIdOrderByUpdatedAtDesc(userId)
                .stream()
                .map(this::mapToConversationResponse)
                .collect(Collectors.toList());
    }

    public ConversationResponse getConversation(String id) {
        Conversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));
        return mapToConversationResponse(conversation);
    }

    public MessageResponse saveMessage(String conversationId, SendMessageRequest request) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        Message message = Message.builder()
                .conversationId(conversationId)
                .role(request.getRole())
                .content(request.getContent())
                .messageType(request.getMessageType())
                .timestamp(LocalDateTime.now())
                .build();

        Message saved = messageRepository.save(message);
        
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);

        return mapToMessageResponse(saved);
    }

    public List<MessageResponse> getMessages(String conversationId) {
        return messageRepository.findByConversationIdOrderByTimestampAsc(conversationId)
                .stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    public List<MessageResponse> getRecentMessages(String conversationId, int limit) {
        return messageRepository.findByConversationIdOrderByTimestampDesc(conversationId, PageRequest.of(0, limit))
                .stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    private ConversationResponse mapToConversationResponse(Conversation c) {
        return ConversationResponse.builder()
                .id(c.getId())
                .userId(c.getUserId())
                .title(c.getTitle())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    private MessageResponse mapToMessageResponse(Message m) {
        return MessageResponse.builder()
                .id(m.getId())
                .conversationId(m.getConversationId())
                .role(m.getRole())
                .content(m.getContent())
                .messageType(m.getMessageType())
                .timestamp(m.getTimestamp())
                .build();
    }
}
