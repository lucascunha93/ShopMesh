package com.shopmesh.orders.event;

import com.shopmesh.orders.entity.Order;

import java.time.Instant;
import java.util.UUID;

/** Comando Orders -> Catalog para efetivar a baixa do estoque reservado. */
public record StockCommitRequestedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId
) {
    public static final String EVENT_TYPE = "STOCK_COMMIT_REQUESTED";

    public static StockCommitRequestedEvent from(Order order) {
        return new StockCommitRequestedEvent(UUID.randomUUID(), EVENT_TYPE, Instant.now(),
                order.getId(), order.getUserId());
    }
}
