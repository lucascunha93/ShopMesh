package com.shopmesh.orders.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class OrderCreatedEventPublisher {
    public static final String ORDER_CREATED_TOPIC = "order.created";

    private static final Logger LOGGER = LoggerFactory.getLogger(OrderCreatedEventPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public OrderCreatedEventPublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void publishAfterCommit(OrderCreatedDomainEvent domainEvent) {
        OrderCreatedEvent event = domainEvent.event();
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(ORDER_CREATED_TOPIC, event.orderId().toString(), payload)
                    .whenComplete((result, exception) -> {
                        if (exception != null) {
                            LOGGER.error("Falha ao publicar evento no tópico {} para orderId={}",
                                    ORDER_CREATED_TOPIC, event.orderId(), exception);
                            return;
                        }

                        RecordMetadata metadata = result.getRecordMetadata();
                        LOGGER.info("Evento publicado no tópico {}, partição {}, offset {}, orderId={}",
                                metadata.topic(), metadata.partition(), metadata.offset(), event.orderId());
                    });
        } catch (JsonProcessingException | RuntimeException exception) {
            LOGGER.error("Falha ao publicar evento no tópico {} para orderId={}",
                    ORDER_CREATED_TOPIC, event.orderId(), exception);
        }
    }
}
