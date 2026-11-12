package com.shopmesh.payments.event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PaymentRefundedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID paymentId,
        UUID userId,
        BigDecimal amount,
        String reason
) {
    public static final String EVENT_TYPE = "PAYMENT_REFUNDED";
}
