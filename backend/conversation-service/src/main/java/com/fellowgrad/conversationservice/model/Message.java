package com.fellowgrad.conversationservice.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "messages")
public class Message {
    @Id
    private String id;
    private String conversationId;
    private Role role;
    private String content;
    private MessageType messageType;
    private LocalDateTime timestamp;

    public enum Role {
        USER, ASSISTANT, SYSTEM
    }

    public enum MessageType {
        TEXT, VOICE
    }
}
