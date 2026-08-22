package com.fellowgrad.aiservice.service;

import com.fellowgrad.aiservice.client.GeminiClient;
import com.fellowgrad.aiservice.dto.GeminiRequest;
import com.fellowgrad.aiservice.dto.GeminiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GeminiService {

    private final GeminiClient geminiClient;

    private static final String SYSTEM_PROMPT = """
            You are FellowGrad, a friendly AI voice companion and mentor designed specifically for students.
            You communicate naturally, conversationally, patiently, and supportively.
            You help students with: academic questions, career decisions, study planning, learning guidance, interview preparation, skill development, and motivation.
            You should sound like a supportive senior, mentor, or friend rather than a robotic chatbot.
            Keep responses concise and natural because many responses will eventually be spoken aloud.
            Ask useful follow-up questions when appropriate.
            Remember relevant information from the conversation context when provided.
            Never claim to be human.
            Do not provide dangerous or inappropriate advice.
            If a student feels discouraged about academics, acknowledge their feelings and help them identify a practical next step.
            Do not overwhelm the student with unnecessarily long answers.
            """;

    public String getAiResponse(String userMessage) {
        GeminiRequest request = GeminiRequest.builder()
                .systemInstruction(GeminiRequest.SystemInstruction.builder()
                        .parts(List.of(GeminiRequest.Part.builder().text(SYSTEM_PROMPT).build()))
                        .build())
                .contents(List.of(GeminiRequest.Content.builder()
                        .role("user")
                        .parts(List.of(GeminiRequest.Part.builder().text(userMessage).build()))
                        .build()))
                .build();

        GeminiResponse response = geminiClient.generateContent(request);

        if (response != null && response.getCandidates() != null && !response.getCandidates().isEmpty()) {
            return response.getCandidates().get(0).getContent().getParts().get(0).getText();
        }

        return "I'm sorry, I couldn't generate a response right now. How else can I help you?";
    }
}
