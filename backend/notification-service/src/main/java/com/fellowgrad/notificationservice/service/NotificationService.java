package com.fellowgrad.notificationservice.service;

import com.fellowgrad.notificationservice.dto.NotificationRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class NotificationService {

    public void sendNotification(NotificationRequest request) {
        log.info("Sending notification to user {}: {}", request.getUserId(), request.getMessage());
        // Future implementation: WebSocket, Push, etc.
    }
}
