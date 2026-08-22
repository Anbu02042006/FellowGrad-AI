package com.fellowgrad.conversationservice.dto;

import com.fellowgrad.conversationservice.model.Message;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class MessageResponse {
    private String id;
    private String conversationId;
    private Message.Role role;
    private String content;
    private Message.MessageType messageType;
    private LocalDateTime timestamp;
}
