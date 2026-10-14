package com.shopmesh.payments.service;

import com.shopmesh.payments.entity.Payment;
import com.shopmesh.payments.repository.PaymentRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class PaymentWriter {
    private final PaymentRepository paymentRepository;

    public PaymentWriter(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Payment saveAndFlush(Payment payment) {
        return paymentRepository.saveAndFlush(payment);
    }
}
