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

class PaymentRequestedListenerTest {
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private final UUID orderId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, String> kafkaTemplate = mock(KafkaTemplate.class);
    private final PaymentProcessor paymentProcessor = mock(PaymentProcessor.class);
    private final PaymentRequestedListener listener =
            new PaymentRequestedListener(objectMapper, paymentProcessor, kafkaTemplate);

    @SuppressWarnings("unchecked")
    @Test
    void approvedPaymentIsPublishedWithOrderIdAsKey() throws Exception {
        Payment payment = payment(PaymentStatus.APPROVED, null);
        when(paymentProcessor.process(any(PaymentRequestedEvent.class))).thenReturn(payment);
        when(kafkaTemplate.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        listener.handle(validPayload());

        ArgumentCaptor<String> payloadCaptor = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq("payment.approved"), eq(orderId.toString()), payloadCaptor.capture());
        JsonNode json = objectMapper.readTree(payloadCaptor.getValue());
        assertEquals("PAYMENT_APPROVED", json.get("eventType").asText());
        assertEquals(orderId.toString(), json.get("orderId").asText());
        assertEquals(userId.toString(), json.get("userId").asText());
        assertEquals(0, new BigDecimal("699.80").compareTo(json.get("amount").decimalValue()));
    }

    @SuppressWarnings("unchecked")
    @Test
    void rejectedPaymentIsPublishedWithReason() throws Exception {
        Payment payment = payment(PaymentStatus.REJECTED, "Limite de aprovação excedido");
        when(paymentProcessor.process(any(PaymentRequestedEvent.class))).thenReturn(payment);
        when(kafkaTemplate.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        listener.handle(validPayload());

        ArgumentCaptor<String> payloadCaptor = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq("payment.rejected"), eq(orderId.toString()), payloadCaptor.capture());
        JsonNode json = objectMapper.readTree(payloadCaptor.getValue());
        assertEquals("PAYMENT_REJECTED", json.get("eventType").asText());
        assertEquals("Limite de aprovação excedido", json.get("reason").asText());
    }

    @Test
    void malformedJsonIsRejectedWithoutProcessing() {
        assertThrows(JsonProcessingException.class, () -> listener.handle("{nao-e-json"));
        verify(paymentProcessor, never()).process(any());
    }

    @Test
    void missingRequiredFieldIsRejectedAsInvalidEvent() {
        String payload = validPayload().replace("\"userId\":\"" + userId + "\",", "");
        assertThrows(InvalidEventException.class, () -> listener.handle(payload));
        verify(paymentProcessor, never()).process(any());
    }

    @Test
    void missingAmountIsRejectedAsInvalidEvent() {
        String payload = validPayload().replace("\"amount\":699.80", "\"amount\":null");
        assertThrows(InvalidEventException.class, () -> listener.handle(payload));
        verify(paymentProcessor, never()).process(any());
    }

    @Test
    void negativeAmountIsRejectedAsInvalidEvent() {
        String payload = validPayload().replace("\"amount\":699.80", "\"amount\":-1");
        assertThrows(InvalidEventException.class, () -> listener.handle(payload));
        verify(paymentProcessor, never()).process(any());
    }

    @Test
    void wrongEventTypeIsRejectedAsInvalidEvent() {
        String payload = validPayload().replace("PAYMENT_REQUESTED", "STOCK_RESERVED");
        assertThrows(InvalidEventException.class, () -> listener.handle(payload));
        verify(paymentProcessor, never()).process(any());
    }

    @Test
    void unknownFieldsAreIgnored() throws Exception {
        Payment payment = payment(PaymentStatus.REJECTED, "Limite de aprovação excedido");
        when(paymentProcessor.process(any(PaymentRequestedEvent.class))).thenReturn(payment);
        @SuppressWarnings("unchecked")
        SendResult<String, String> result = mock(SendResult.class);
        when(kafkaTemplate.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(result));

        listener.handle(validPayload().replace("{\"eventId\"", "{\"campoNovo\":true,\"eventId\""));

        verify(kafkaTemplate).send(eq("payment.rejected"), eq(orderId.toString()), anyString());
    }

    private String validPayload() {
        return "{\"eventId\":\"" + UUID.randomUUID() + "\","
                + "\"eventType\":\"PAYMENT_REQUESTED\","
                + "\"occurredAt\":\"2026-10-07T03:20:06.021Z\","
                + "\"orderId\":\"" + orderId + "\","
                + "\"userId\":\"" + userId + "\","
                + "\"amount\":699.80}";
    }

    private Payment payment(PaymentStatus status, String reason) {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setOrderId(orderId);
        payment.setUserId(userId);
        payment.setAmount(new BigDecimal("699.80"));
        payment.setStatus(status);
        payment.setReason(reason);
        return payment;
    }
}
