package com.shopmesh.orders.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderCreatedEventPublisherTest {
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @SuppressWarnings("unchecked")
    @Test
    void publishesContractJsonWithOrderIdAsKafkaKey() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Instant occurredAt = Instant.parse("2026-10-07T03:20:06.021Z");
        OrderCreatedEvent event = new OrderCreatedEvent(
                UUID.randomUUID(),
                "ORDER_CREATED",
                occurredAt,
                orderId,
                userId,
                new BigDecimal("699.80"),
                List.of(new OrderCreatedEvent.Item("product-123", 2, new BigDecimal("349.90")))
        );

        KafkaTemplate<String, String> kafkaTemplate = mock(KafkaTemplate.class);
        SendResult<String, String> sendResult = mock(SendResult.class);
        RecordMetadata metadata = mock(RecordMetadata.class);
        when(metadata.topic()).thenReturn(OrderCreatedEventPublisher.ORDER_CREATED_TOPIC);
        when(metadata.partition()).thenReturn(0);
        when(metadata.offset()).thenReturn(0L);
        when(sendResult.getRecordMetadata()).thenReturn(metadata);
        when(kafkaTemplate.send(
                OrderCreatedEventPublisher.ORDER_CREATED_TOPIC,
                orderId.toString(),
                objectMapper.writeValueAsString(event)
        )).thenReturn(CompletableFuture.completedFuture(sendResult));

        OrderCreatedEventPublisher publisher = new OrderCreatedEventPublisher(kafkaTemplate, objectMapper);
        publisher.publishAfterCommit(new OrderCreatedDomainEvent(event));

        var payloadCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(
                org.mockito.ArgumentMatchers.eq(OrderCreatedEventPublisher.ORDER_CREATED_TOPIC),
                org.mockito.ArgumentMatchers.eq(orderId.toString()),
                payloadCaptor.capture()
        );

        JsonNode json = objectMapper.readTree(payloadCaptor.getValue());
        assertTrue(UUID.fromString(json.get("eventId").asText()).version() == 4);
        assertEquals("ORDER_CREATED", json.get("eventType").asText());
        assertEquals(occurredAt.toString(), json.get("occurredAt").asText());
        assertTrue(json.get("occurredAt").asText().endsWith("Z"));
        assertEquals(orderId.toString(), json.get("orderId").asText());
        assertEquals(userId.toString(), json.get("userId").asText());
        assertTrue(json.get("totalAmount").isNumber());
        assertEquals(0, new BigDecimal("699.80").compareTo(json.get("totalAmount").decimalValue()));

        JsonNode item = json.get("items").get(0);
        assertEquals("product-123", item.get("productId").asText());
        assertEquals(2, item.get("quantity").asInt());
        assertTrue(item.get("unitPrice").isNumber());
        assertEquals(0, new BigDecimal("349.90").compareTo(item.get("unitPrice").decimalValue()));
    }
}
