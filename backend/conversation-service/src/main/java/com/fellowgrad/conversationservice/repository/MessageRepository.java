package com.fellowgrad.conversationservice.repository;

import com.fellowgrad.conversationservice.model.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MessageRepository extends MongoRepository<Message, String> {
    List<Message> findByConversationIdOrderByTimestampAsc(String conversationId);
    List<Message> findByConversationIdOrderByTimestampDesc(String conversationId, Pageable pageable);
}
