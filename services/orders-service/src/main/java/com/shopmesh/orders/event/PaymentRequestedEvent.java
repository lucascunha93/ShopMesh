package com.shopmesh.orders.event;

import com.shopmesh.orders.entity.Order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Comando Orders -> Payments para cobrar o pedido. */
public record PaymentRequestedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId,
        BigDecimal amount
) {
    public static final String EVENT_TYPE = "PAYMENT_REQUESTED";

    public static PaymentRequestedEvent from(Order order) {
        return new PaymentRequestedEvent(UUID.randomUUID(), EVENT_TYPE, Instant.now(),
                order.getId(), order.getUserId(), order.getTotalAmount());
    }
}
