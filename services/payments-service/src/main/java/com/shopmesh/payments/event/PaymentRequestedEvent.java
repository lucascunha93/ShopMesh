package com.shopmesh.payments.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PaymentRequestedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId,
        BigDecimal amount
) {
    public static final String EVENT_TYPE = "PAYMENT_REQUESTED";

    /**
     * Garante os campos obrigatórios do contrato. Um evento inválido não é
     * retentado: segue direto para {@code payment.requested.DLT}.
     */
    public PaymentRequestedEvent validate() {
        if (eventId == null || occurredAt == null || orderId == null || userId == null
                || amount == null || !EVENT_TYPE.equals(eventType)) {
            throw new InvalidEventException("Evento PAYMENT_REQUESTED sem campos obrigatórios");
        }
        if (amount.signum() < 0) {
            throw new InvalidEventException("Evento PAYMENT_REQUESTED com amount negativo");
        }
        return this;
    }
}
