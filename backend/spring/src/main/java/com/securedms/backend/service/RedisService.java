package com.securedms.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Base64;

@Service
@RequiredArgsConstructor
@Slf4j
public class RedisService {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public void enqueueDocumentProcessingTask(UUID documentId, UUID versionId, UUID userId, String documentType, String storagePath) {
        try {
            String taskId = UUID.randomUUID().toString();
            
            // Standard Celery Message Format (v2 protocol)
            Map<String, Object> taskMessage = new HashMap<>();
            
            // The body is a tuple of (args, kwargs, embed)
            List<Object> args = List.of(documentId.toString(), versionId.toString(), userId.toString(), documentType, storagePath);
            Map<String, Object> kwargs = new HashMap<>();
            
            List<Object> bodyTuple = List.of(args, kwargs, new HashMap<>());
            String bodyJson = objectMapper.writeValueAsString(bodyTuple);
            String encodedBody = Base64.getEncoder().encodeToString(bodyJson.getBytes());

            Map<String, Object> headers = new HashMap<>();
            headers.put("lang", "py");
            headers.put("task", "tasks.process_document");
            headers.put("id", taskId);
            
            taskMessage.put("body", encodedBody);
            taskMessage.put("content-encoding", "utf-8");
            taskMessage.put("content-type", "application/json");
            taskMessage.put("headers", headers);
            taskMessage.put("properties", Map.of(
                    "correlation_id", taskId,
                    "reply_to", UUID.randomUUID().toString(),
                    "delivery_mode", 2,
                    "delivery_info", Map.of("exchange", "", "routing_key", "celery"),
                    "priority", 0,
                    "body_encoding", "base64",
                    "delivery_tag", UUID.randomUUID().toString()
            ));

            String jsonPayload = objectMapper.writeValueAsString(taskMessage);
            
            // Push to celery list in Redis
            redisTemplate.opsForList().leftPush("celery", jsonPayload);
            log.info("Enqueued Celery task {} for document {}", taskId, documentId);

        } catch (Exception e) {
            log.error("Failed to enqueue celery task", e);
            throw new RuntimeException("Could not enqueue processing task", e);
        }
    }
}
