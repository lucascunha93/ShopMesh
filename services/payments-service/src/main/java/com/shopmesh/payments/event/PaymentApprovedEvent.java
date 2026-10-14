package com.shopmesh.payments.event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PaymentApprovedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID paymentId,
        UUID userId,
        BigDecimal amount
) {
}
