package com.shopmesh.orders.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.UUID;

/** Reserva de estoque concluída pelo Catalog; o Orders só precisa do orderId. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record StockReservedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId
) {
    public static final String EVENT_TYPE = "STOCK_RESERVED";

    public StockReservedEvent validate() {
        if (eventId == null || occurredAt == null || orderId == null || !EVENT_TYPE.equals(eventType)) {
            throw new InvalidEventException("Evento STOCK_RESERVED sem campos obrigatórios");
        }
        return this;
    }
}
