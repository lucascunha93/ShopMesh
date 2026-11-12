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
public class PaymentRequestedListener {
    public static final String PAYMENT_REQUESTED_TOPIC = "payment.requested";
    public static final String PAYMENT_APPROVED_TOPIC = "payment.approved";
    public static final String PAYMENT_REJECTED_TOPIC = "payment.rejected";

    private final ObjectMapper objectMapper;
    private final PaymentProcessor paymentProcessor;
    private final KafkaTemplate<String, String> kafkaTemplate;

    public PaymentRequestedListener(ObjectMapper objectMapper,
                                    PaymentProcessor paymentProcessor,
                                    KafkaTemplate<String, String> kafkaTemplate) {
        this.objectMapper = objectMapper;
        this.paymentProcessor = paymentProcessor;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = PAYMENT_REQUESTED_TOPIC, groupId = "payments-service")
    public void handle(String payload) throws Exception {
        PaymentRequestedEvent requestedEvent = objectMapper.readValue(payload, PaymentRequestedEvent.class).validate();
        Payment payment = paymentProcessor.process(requestedEvent);
        String resultPayload = serializeResult(payment);
        String topic = payment.getStatus() == PaymentStatus.REJECTED
                ? PAYMENT_REJECTED_TOPIC
                : PAYMENT_APPROVED_TOPIC;

        kafkaTemplate.send(topic, payment.getOrderId().toString(), resultPayload)
                .get(10, TimeUnit.SECONDS);
    }

    private String serializeResult(Payment payment) throws JsonProcessingException {
        UUID eventId = UUID.randomUUID();
        Instant occurredAt = Instant.now();
        if (payment.getStatus() == PaymentStatus.REJECTED) {
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
        // Um pagamento já estornado reaparece como aprovado para reentregas tardias de payment.requested.
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
}
