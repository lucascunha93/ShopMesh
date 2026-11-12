package com.shopmesh.payments.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopmesh.payments.entity.Payment;
import com.shopmesh.payments.service.PaymentProcessor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Component
public class PaymentRefundRequestedListener {
    private static final Logger log = LoggerFactory.getLogger(PaymentRefundRequestedListener.class);

    public static final String PAYMENT_REFUND_REQUESTED_TOPIC = "payment.refund.requested";
    public static final String PAYMENT_REFUNDED_TOPIC = "payment.refunded";

    private final ObjectMapper objectMapper;
    private final PaymentProcessor paymentProcessor;
    private final KafkaTemplate<String, String> kafkaTemplate;

    public PaymentRefundRequestedListener(ObjectMapper objectMapper,
                                          PaymentProcessor paymentProcessor,
                                          KafkaTemplate<String, String> kafkaTemplate) {
        this.objectMapper = objectMapper;
        this.paymentProcessor = paymentProcessor;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = PAYMENT_REFUND_REQUESTED_TOPIC, groupId = "payments-service")
    public void handle(String payload) throws Exception {
        PaymentRefundRequestedEvent requestedEvent =
                objectMapper.readValue(payload, PaymentRefundRequestedEvent.class).validate();
        Optional<Payment> refunded = paymentProcessor.refund(requestedEvent);
        if (refunded.isEmpty()) {
            log.info("Estorno ignorado: não há pagamento aprovado para o pedido {}", requestedEvent.orderId());
            return;
        }

        Payment payment = refunded.get();
        // eventId derivado do pedido: o reenvio de um estorno já feito repete o mesmo evento.
        String resultPayload = objectMapper.writeValueAsString(new PaymentRefundedEvent(
                UUID.nameUUIDFromBytes(("payment.refunded:" + payment.getOrderId()).getBytes(StandardCharsets.UTF_8)),
                PaymentRefundedEvent.EVENT_TYPE,
                payment.getUpdatedAt() != null ? payment.getUpdatedAt() : Instant.now(),
                payment.getOrderId(),
                payment.getId(),
                payment.getUserId(),
                payment.getAmount(),
                payment.getRefundReason()
        ));
        kafkaTemplate.send(PAYMENT_REFUNDED_TOPIC, payment.getOrderId().toString(), resultPayload)
                .get(10, TimeUnit.SECONDS);
    }
}
