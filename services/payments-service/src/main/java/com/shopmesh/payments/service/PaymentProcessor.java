package com.shopmesh.payments.service;

import com.shopmesh.payments.entity.Payment;
import com.shopmesh.payments.entity.PaymentStatus;
import com.shopmesh.payments.event.OrderCreatedEvent;
import com.shopmesh.payments.repository.PaymentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Service
public class PaymentProcessor {
    private final PaymentRepository paymentRepository;
    private final PaymentWriter paymentWriter;
    private final BigDecimal approvalLimit;

    public PaymentProcessor(PaymentRepository paymentRepository,
                            PaymentWriter paymentWriter,
                            @Value("${payment.approval-limit:5000}") BigDecimal approvalLimit) {
        this.paymentRepository = paymentRepository;
        this.paymentWriter = paymentWriter;
        this.approvalLimit = approvalLimit;
    }

    @Transactional
    public Payment process(OrderCreatedEvent event) {
        return paymentRepository.findByOrderId(event.orderId())
                .orElseGet(() -> createPaymentOrLoadExisting(event));
    }

    private Payment createPaymentOrLoadExisting(OrderCreatedEvent event) {
        Payment payment = new Payment();
        payment.setOrderId(event.orderId());
        payment.setUserId(event.userId());
        payment.setAmount(event.totalAmount());
        if (event.totalAmount().compareTo(approvalLimit) <= 0) {
            payment.setStatus(PaymentStatus.APPROVED);
        } else {
            payment.setStatus(PaymentStatus.REJECTED);
            payment.setReason("Limite de aprovação excedido (limite: "
                    + formatAmount(approvalLimit) + ", valor: " + formatAmount(event.totalAmount()) + ")");
        }

        try {
            return paymentWriter.saveAndFlush(payment);
        } catch (DataIntegrityViolationException exception) {
            UUID orderId = event.orderId();
            return paymentRepository.findByOrderId(orderId)
                    .orElseThrow(() -> exception);
        }
    }

    private String formatAmount(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
