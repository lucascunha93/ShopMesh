package com.shopmesh.payments.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record StockReservedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId,
        BigDecimal totalAmount,
        List<Item> items
) {
    public static final String EVENT_TYPE = "STOCK_RESERVED";

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(
            String productId,
            Integer quantity
    ) {
    }

    /**
     * Garante os campos obrigatórios do contrato. Um evento inválido não é
     * retentado: segue direto para {@code stock.reserved.DLT}.
     */
    public StockReservedEvent validate() {
        if (eventId == null || occurredAt == null || orderId == null || userId == null
                || totalAmount == null || items == null || items.isEmpty()
                || !EVENT_TYPE.equals(eventType)) {
            throw new InvalidEventException("Evento STOCK_RESERVED sem campos obrigatórios");
        }
        if (totalAmount.signum() < 0) {
            throw new InvalidEventException("Evento STOCK_RESERVED com totalAmount negativo");
        }
        for (Item item : items) {
            if (item == null || item.productId() == null || item.productId().isBlank()
                    || item.quantity() == null || item.quantity() < 1) {
                throw new InvalidEventException("Evento STOCK_RESERVED com item inválido");
            }
        }
        return this;
    }
}
