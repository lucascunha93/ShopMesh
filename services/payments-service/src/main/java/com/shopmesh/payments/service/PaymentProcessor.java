package com.shopmesh.payments.service;

import com.shopmesh.payments.entity.Payment;
import com.shopmesh.payments.entity.PaymentStatus;
import com.shopmesh.payments.event.PaymentRefundRequestedEvent;
import com.shopmesh.payments.event.PaymentRequestedEvent;
import com.shopmesh.payments.repository.PaymentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
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
    public Payment process(PaymentRequestedEvent event) {
        return paymentRepository.findByOrderId(event.orderId())
                .orElseGet(() -> createPaymentOrLoadExisting(event));
    }

    /**
     * Estorna o pagamento aprovado do pedido. Idempotente: um pagamento já
     * estornado é devolvido como está. Retorna vazio quando não há nada a
     * estornar (pagamento inexistente ou rejeitado).
     */
    @Transactional
    public Optional<Payment> refund(PaymentRefundRequestedEvent event) {
        return paymentRepository.findByOrderId(event.orderId())
                .flatMap(payment -> {
                    if (payment.getStatus() == PaymentStatus.REFUNDED) {
                        return Optional.of(payment);
                    }
                    if (payment.getStatus() != PaymentStatus.APPROVED) {
                        return Optional.empty();
                    }
                    payment.setStatus(PaymentStatus.REFUNDED);
                    payment.setRefundReason(event.reason());
                    return Optional.of(paymentRepository.saveAndFlush(payment));
                });
    }

    private Payment createPaymentOrLoadExisting(PaymentRequestedEvent event) {
        Payment payment = new Payment();
        payment.setOrderId(event.orderId());
        payment.setUserId(event.userId());
        payment.setAmount(event.amount());
        if (event.amount().compareTo(approvalLimit) <= 0) {
            payment.setStatus(PaymentStatus.APPROVED);
        } else {
            payment.setStatus(PaymentStatus.REJECTED);
            payment.setReason("Limite de aprovação excedido (limite: "
                    + formatAmount(approvalLimit) + ", valor: " + formatAmount(event.amount()) + ")");
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
