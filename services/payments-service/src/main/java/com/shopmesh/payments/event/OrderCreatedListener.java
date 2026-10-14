package com.shopmesh.payments.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopmesh.payments.entity.Payment;
import com.shopmesh.payments.entity.PaymentStatus;
import com.shopmesh.payments.service.PaymentProcessor;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Component
public class OrderCreatedListener {
    private static final String ORDER_CREATED_TOPIC = "order.created";

    private final ObjectMapper objectMapper;
    private final PaymentProcessor paymentProcessor;
    private final KafkaTemplate<String, String> kafkaTemplate;

    public OrderCreatedListener(ObjectMapper objectMapper,
                                PaymentProcessor paymentProcessor,
                                KafkaTemplate<String, String> kafkaTemplate) {
        this.objectMapper = objectMapper;
        this.paymentProcessor = paymentProcessor;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = ORDER_CREATED_TOPIC, groupId = "payments-service")
    public void handle(String payload) throws Exception {
        OrderCreatedEvent orderEvent = objectMapper.readValue(payload, OrderCreatedEvent.class);
        Payment payment = paymentProcessor.process(orderEvent);
        String resultPayload = serializeResult(payment);
        String topic = payment.getStatus() == PaymentStatus.APPROVED
                ? "payment.approved"
                : "payment.rejected";

        kafkaTemplate.send(topic, payment.getOrderId().toString(), resultPayload)
                .get(10, TimeUnit.SECONDS);
    }

    private String serializeResult(Payment payment) throws JsonProcessingException {
        UUID eventId = UUID.randomUUID();
        Instant occurredAt = Instant.now();
        if (payment.getStatus() == PaymentStatus.APPROVED) {
            return objectMapper.writeValueAsString(new PaymentApprovedEvent(
                    eventId,
                    "PAYMENT_APPROVED",
                    occurredAt,
                    payment.getOrderId(),
                    payment.getId(),
                    payment.getUserId(),
                    payment.getAmount()
            ));
        }
        return objectMapper.writeValueAsString(new PaymentRejectedEvent(
                eventId,
                "PAYMENT_REJECTED",
                occurredAt,
                payment.getOrderId(),
                payment.getId(),
                payment.getUserId(),
                payment.getAmount(),
                payment.getReason()
        ));
    }
}
