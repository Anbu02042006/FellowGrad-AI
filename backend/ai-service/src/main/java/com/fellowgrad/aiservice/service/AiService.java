package com.fellowgrad.aiservice.service;

import com.fellowgrad.aiservice.dto.ChatRequest;
import com.fellowgrad.aiservice.dto.ChatResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AiService {

    private final GeminiService geminiService;

    public ChatResponse processChat(ChatRequest request) {
        String reply = geminiService.getAiResponse(request.getMessage());
        return ChatResponse.builder()
                .reply(reply)
                .build();
    }
}
