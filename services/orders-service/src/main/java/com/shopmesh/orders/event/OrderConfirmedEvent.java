package com.shopmesh.orders.event;

import com.shopmesh.orders.entity.Order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Evento informativo (consumido pelo notifications-service) de pedido confirmado. */
public record OrderConfirmedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId,
        BigDecimal totalAmount
) {
    public static final String EVENT_TYPE = "ORDER_CONFIRMED";

    public static OrderConfirmedEvent from(Order order) {
        return new OrderConfirmedEvent(UUID.randomUUID(), EVENT_TYPE, Instant.now(),
                order.getId(), order.getUserId(), order.getTotalAmount());
    }
}
