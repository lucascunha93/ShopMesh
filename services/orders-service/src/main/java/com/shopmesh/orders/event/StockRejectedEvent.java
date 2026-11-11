package com.shopmesh.orders.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record StockRejectedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId,
        String reason
) {
    public static final String EVENT_TYPE = "STOCK_REJECTED";

    public StockRejectedEvent validate() {
        if (eventId == null || occurredAt == null || orderId == null || userId == null
                || !EVENT_TYPE.equals(eventType)) {
            throw new InvalidEventException("Evento STOCK_REJECTED sem campos obrigatórios");
        }
        return this;
    }
}
