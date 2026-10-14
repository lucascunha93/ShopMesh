package com.shopmesh.payments.service;

import com.shopmesh.payments.entity.Payment;
import com.shopmesh.payments.entity.PaymentStatus;
import com.shopmesh.payments.event.OrderCreatedEvent;
import com.shopmesh.payments.repository.PaymentRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentProcessorTest {
    private static final BigDecimal APPROVAL_LIMIT = new BigDecimal("5000.00");

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private PaymentWriter paymentWriter;

    private PaymentProcessor paymentProcessor;

    @BeforeEach
    void setUp() {
        paymentProcessor = new PaymentProcessor(paymentRepository, paymentWriter, APPROVAL_LIMIT);
    }

    @Test
    void approvesAmountBelowLimit() {
        assertStatusForAmount("4999.99", PaymentStatus.APPROVED, null);
    }

    @Test
    void approvesAmountEqualToLimit() {
        assertStatusForAmount("5000.00", PaymentStatus.APPROVED, null);
    }

    @Test
    void rejectsAmountAboveLimitWithReadableReason() {
        assertStatusForAmount(
                "6998.00",
                PaymentStatus.REJECTED,
                "Limite de aprovação excedido (limite: 5000.00, valor: 6998.00)"
        );
    }

    @Test
    void processingSameEventTwiceCreatesOnlyOnePayment() {
        OrderCreatedEvent event = event("699.80");
        Payment savedPayment = new Payment();
        savedPayment.setOrderId(event.orderId());
        savedPayment.setUserId(event.userId());
        savedPayment.setAmount(event.totalAmount());
        savedPayment.setStatus(PaymentStatus.APPROVED);

        when(paymentRepository.findByOrderId(event.orderId()))
                .thenReturn(Optional.empty(), Optional.of(savedPayment));
        when(paymentWriter.saveAndFlush(any(Payment.class))).thenReturn(savedPayment);

        Payment firstResult = paymentProcessor.process(event);
        Payment secondResult = paymentProcessor.process(event);

        assertSame(savedPayment, firstResult);
        assertSame(savedPayment, secondResult);
        verify(paymentWriter).saveAndFlush(any(Payment.class));
        verify(paymentRepository, org.mockito.Mockito.times(2)).findByOrderId(event.orderId());
    }

    @Test
    void loadsExistingPaymentWhenConcurrentInsertViolatesUniqueConstraint() {
        OrderCreatedEvent event = event("699.80");
        Payment existingPayment = new Payment();
        existingPayment.setOrderId(event.orderId());
        existingPayment.setUserId(event.userId());
        existingPayment.setAmount(event.totalAmount());
        existingPayment.setStatus(PaymentStatus.APPROVED);

        when(paymentRepository.findByOrderId(event.orderId()))
                .thenReturn(Optional.empty(), Optional.of(existingPayment));
        when(paymentWriter.saveAndFlush(any(Payment.class)))
                .thenThrow(new DataIntegrityViolationException("unique order_id"));

        Payment result = paymentProcessor.process(event);

        assertSame(existingPayment, result);
        verify(paymentRepository, org.mockito.Mockito.times(2)).findByOrderId(event.orderId());
    }

    private void assertStatusForAmount(String amount, PaymentStatus expectedStatus, String expectedReason) {
        OrderCreatedEvent event = event(amount);
        when(paymentRepository.findByOrderId(event.orderId())).thenReturn(Optional.empty());
        when(paymentWriter.saveAndFlush(any(Payment.class)))
                .thenAnswer(invocation -> invocation.getArgument(0, Payment.class));

        Payment payment = paymentProcessor.process(event);

        ArgumentCaptor<Payment> paymentCaptor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentWriter).saveAndFlush(paymentCaptor.capture());
        assertEquals(expectedStatus, payment.getStatus());
        assertEquals(new BigDecimal(amount), payment.getAmount());
        assertEquals(expectedReason, payment.getReason());
        assertEquals(expectedStatus, paymentCaptor.getValue().getStatus());
    }

    private OrderCreatedEvent event(String amount) {
        return new OrderCreatedEvent(
                UUID.randomUUID(),
                "ORDER_CREATED",
                Instant.parse("2026-10-07T03:20:06.021Z"),
                UUID.randomUUID(),
                UUID.randomUUID(),
                new BigDecimal(amount),
                java.util.List.of()
        );
    }
}
