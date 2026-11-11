package com.shopmesh.orders.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PaymentRejectedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID paymentId,
        UUID userId,
        BigDecimal amount,
        String reason
) {
    public static final String EVENT_TYPE = "PAYMENT_REJECTED";

    public PaymentRejectedEvent validate() {
        if (eventId == null || occurredAt == null || orderId == null || paymentId == null
                || userId == null || amount == null || !EVENT_TYPE.equals(eventType)) {
            throw new InvalidEventException("Evento PAYMENT_REJECTED sem campos obrigatórios");
        }
        return this;
    }
}
