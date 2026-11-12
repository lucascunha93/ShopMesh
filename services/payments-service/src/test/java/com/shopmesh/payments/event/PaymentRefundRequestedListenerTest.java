package com.shopmesh.payments.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.shopmesh.payments.entity.Payment;
import com.shopmesh.payments.entity.PaymentStatus;
import com.shopmesh.payments.service.PaymentProcessor;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentRefundRequestedListenerTest {
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private final UUID orderId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, String> kafkaTemplate = mock(KafkaTemplate.class);
    private final PaymentProcessor paymentProcessor = mock(PaymentProcessor.class);
    private final PaymentRefundRequestedListener listener =
            new PaymentRefundRequestedListener(objectMapper, paymentProcessor, kafkaTemplate);

    @SuppressWarnings("unchecked")
    @Test
    void refundedPaymentIsPublishedWithOrderIdAsKey() throws Exception {
        when(paymentProcessor.refund(any(PaymentRefundRequestedEvent.class)))
                .thenReturn(Optional.of(refundedPayment("Pedido cancelado")));
        when(kafkaTemplate.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        listener.handle(validPayload("\"Pedido cancelado\""));

        ArgumentCaptor<String> payloadCaptor = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq("payment.refunded"), eq(orderId.toString()), payloadCaptor.capture());
        JsonNode json = objectMapper.readTree(payloadCaptor.getValue());
        assertEquals("PAYMENT_REFUNDED", json.get("eventType").asText());
        assertEquals(orderId.toString(), json.get("orderId").asText());
        assertEquals(userId.toString(), json.get("userId").asText());
        assertEquals(0, new BigDecimal("699.80").compareTo(json.get("amount").decimalValue()));
        assertEquals("Pedido cancelado", json.get("reason").asText());
        assertEquals(false, json.get("paymentId").isNull());
    }

    @SuppressWarnings("unchecked")
    @Test
    void resendingRefundRepeatsTheSameEvent() throws Exception {
        Payment payment = refundedPayment(null);
        when(paymentProcessor.refund(any(PaymentRefundRequestedEvent.class))).thenReturn(Optional.of(payment));
        when(kafkaTemplate.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        listener.handle(validPayload("null"));
        listener.handle(validPayload("null"));

        ArgumentCaptor<String> payloadCaptor = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate, org.mockito.Mockito.times(2))
                .send(eq("payment.refunded"), eq(orderId.toString()), payloadCaptor.capture());
        assertEquals(payloadCaptor.getAllValues().get(0), payloadCaptor.getAllValues().get(1));
        assertEquals(true, objectMapper.readTree(payloadCaptor.getValue()).get("reason").isNull());
    }

    @Test
    void nothingToRefundPublishesNothing() throws Exception {
        when(paymentProcessor.refund(any(PaymentRefundRequestedEvent.class))).thenReturn(Optional.empty());

        listener.handle(validPayload("\"Pedido cancelado\""));

        verify(kafkaTemplate, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void malformedJsonIsRejectedWithoutProcessing() {
        assertThrows(JsonProcessingException.class, () -> listener.handle("{nao-e-json"));
        verify(paymentProcessor, never()).refund(any());
    }

    @Test
    void missingRequiredFieldIsRejectedAsInvalidEvent() {
        String payload = validPayload("null").replace("\"userId\":\"" + userId + "\",", "");
        assertThrows(InvalidEventException.class, () -> listener.handle(payload));
        verify(paymentProcessor, never()).refund(any());
    }

    @Test
    void wrongEventTypeIsRejectedAsInvalidEvent() {
        String payload = validPayload("null").replace("PAYMENT_REFUND_REQUESTED", "PAYMENT_REQUESTED");
        assertThrows(InvalidEventException.class, () -> listener.handle(payload));
        verify(paymentProcessor, never()).refund(any());
    }

    private String validPayload(String reasonJson) {
        return "{\"eventId\":\"" + UUID.randomUUID() + "\","
                + "\"eventType\":\"PAYMENT_REFUND_REQUESTED\","
                + "\"occurredAt\":\"2026-10-07T03:20:06.021Z\","
                + "\"orderId\":\"" + orderId + "\","
                + "\"userId\":\"" + userId + "\","
                + "\"reason\":" + reasonJson + ","
                + "\"campoNovo\":true}";
    }

    private Payment refundedPayment(String refundReason) {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setOrderId(orderId);
        payment.setUserId(userId);
        payment.setAmount(new BigDecimal("699.80"));
        payment.setStatus(PaymentStatus.REFUNDED);
        payment.setRefundReason(refundReason);
        payment.setUpdatedAt(Instant.parse("2026-10-07T03:21:00Z"));
        return payment;
    }
}
