package com.shopmesh.orders.event;

import com.shopmesh.orders.entity.Order;

import java.time.Instant;
import java.util.UUID;

public record OrderCancelledEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId,
        String reason
) {
    public static OrderCancelledEvent from(Order order) {
        return new OrderCancelledEvent(
                UUID.randomUUID(),
                "ORDER_CANCELLED",
                Instant.now(),
                order.getId(),
                order.getUserId(),
                order.getStatusReason()
        );
    }
}
