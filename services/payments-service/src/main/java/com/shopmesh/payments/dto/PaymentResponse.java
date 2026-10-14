package com.shopmesh.payments.dto;

import com.shopmesh.payments.entity.Payment;
import com.shopmesh.payments.entity.PaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PaymentResponse(
        UUID id,
        UUID orderId,
        BigDecimal amount,
        PaymentStatus status,
        String reason,
        Instant createdAt,
        Instant updatedAt
) {
    public static PaymentResponse from(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getOrderId(),
                payment.getAmount(),
                payment.getStatus(),
                payment.getReason(),
                payment.getCreatedAt(),
                payment.getUpdatedAt()
        );
    }
}
