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
public class StockReservedListener {
    public static final String STOCK_RESERVED_TOPIC = "stock.reserved";
    public static final String PAYMENT_APPROVED_TOPIC = "payment.approved";
    public static final String PAYMENT_REJECTED_TOPIC = "payment.rejected";

    private final ObjectMapper objectMapper;
    private final PaymentProcessor paymentProcessor;
    private final KafkaTemplate<String, String> kafkaTemplate;

    public StockReservedListener(ObjectMapper objectMapper,
                                 PaymentProcessor paymentProcessor,
                                 KafkaTemplate<String, String> kafkaTemplate) {
        this.objectMapper = objectMapper;
        this.paymentProcessor = paymentProcessor;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = STOCK_RESERVED_TOPIC, groupId = "payments-service")
    public void handle(String payload) throws Exception {
        StockReservedEvent stockEvent = objectMapper.readValue(payload, StockReservedEvent.class).validate();
        Payment payment = paymentProcessor.process(stockEvent);
        String resultPayload = serializeResult(payment);
        String topic = payment.getStatus() == PaymentStatus.APPROVED
                ? PAYMENT_APPROVED_TOPIC
                : PAYMENT_REJECTED_TOPIC;

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
