package com.shopmesh.orders.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class SagaMessagePublisher {
    private static final Logger LOGGER = LoggerFactory.getLogger(SagaMessagePublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public SagaMessagePublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void publishAfterCommit(SagaMessage message) {
        try {
            String payload = objectMapper.writeValueAsString(message.payload());
            kafkaTemplate.send(message.topic(), message.orderId().toString(), payload)
                    .whenComplete((result, exception) -> {
                        if (exception != null) {
                            LOGGER.error("Falha ao publicar mensagem no tópico {} para orderId={}",
                                    message.topic(), message.orderId(), exception);
                            return;
                        }
                        LOGGER.info("Mensagem publicada no tópico {}, orderId={}",
                                message.topic(), message.orderId());
                    });
        } catch (JsonProcessingException | RuntimeException exception) {
            LOGGER.error("Falha ao publicar mensagem no tópico {} para orderId={}",
                    message.topic(), message.orderId(), exception);
        }
    }
}
