package com.fellowgrad.conversationservice.dto;

import com.fellowgrad.conversationservice.model.Message;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SendMessageRequest {
    @NotNull(message = "Role is required")
    private Message.Role role;
    
    @NotBlank(message = "Content is required")
    private String content;
    
    @NotNull(message = "Message type is required")
    private Message.MessageType messageType;
}
