package com.shopmesh.orders.event;

import com.shopmesh.orders.entity.Order;

import java.time.Instant;
import java.util.UUID;

/** Comando Orders -> Catalog para liberar a reserva de estoque. */
public record StockReleaseRequestedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId,
        String reason
) {
    public static final String EVENT_TYPE = "STOCK_RELEASE_REQUESTED";

    public static StockReleaseRequestedEvent from(Order order, String reason) {
        return new StockReleaseRequestedEvent(UUID.randomUUID(), EVENT_TYPE, Instant.now(),
                order.getId(), order.getUserId(), reason);
    }
}
