package com.shopmesh.payments.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PaymentRefundRequestedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId,
        String reason
) {
    public static final String EVENT_TYPE = "PAYMENT_REFUND_REQUESTED";

    /**
     * Garante os campos obrigatórios do contrato ({@code reason} é opcional).
     * Um evento inválido não é retentado: segue direto para
     * {@code payment.refund.requested.DLT}.
     */
    public PaymentRefundRequestedEvent validate() {
        if (eventId == null || occurredAt == null || orderId == null || userId == null
                || !EVENT_TYPE.equals(eventType)) {
            throw new InvalidEventException("Evento PAYMENT_REFUND_REQUESTED sem campos obrigatórios");
        }
        return this;
    }
}
