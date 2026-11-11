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
public class OrderCancelledEventPublisher {
    public static final String ORDER_CANCELLED_TOPIC = "order.cancelled";

    private static final Logger LOGGER = LoggerFactory.getLogger(OrderCancelledEventPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public OrderCancelledEventPublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void publishAfterCommit(OrderCancelledDomainEvent domainEvent) {
        OrderCancelledEvent event = domainEvent.event();
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(ORDER_CANCELLED_TOPIC, event.orderId().toString(), payload)
                    .whenComplete((result, exception) -> {
                        if (exception != null) {
                            LOGGER.error("Falha ao publicar evento no tópico {} para orderId={}",
                                    ORDER_CANCELLED_TOPIC, event.orderId(), exception);
                            return;
                        }
                        LOGGER.info("Evento publicado no tópico {}, orderId={}",
                                ORDER_CANCELLED_TOPIC, event.orderId());
                    });
        } catch (JsonProcessingException | RuntimeException exception) {
            LOGGER.error("Falha ao publicar evento no tópico {} para orderId={}",
                    ORDER_CANCELLED_TOPIC, event.orderId(), exception);
        }
    }
}
