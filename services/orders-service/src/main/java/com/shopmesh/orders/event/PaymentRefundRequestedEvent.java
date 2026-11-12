package com.shopmesh.orders.event;

import com.shopmesh.orders.entity.Order;

import java.time.Instant;
import java.util.UUID;

/** Comando Orders -> Payments para estornar um pagamento já aprovado. */
public record PaymentRefundRequestedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId,
        String reason
) {
    public static final String EVENT_TYPE = "PAYMENT_REFUND_REQUESTED";

    public static PaymentRefundRequestedEvent from(Order order, String reason) {
        return new PaymentRefundRequestedEvent(UUID.randomUUID(), EVENT_TYPE, Instant.now(),
                order.getId(), order.getUserId(), reason);
    }
}
