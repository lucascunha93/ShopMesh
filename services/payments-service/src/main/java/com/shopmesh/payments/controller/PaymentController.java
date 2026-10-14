package com.shopmesh.payments.controller;

import com.shopmesh.payments.dto.PaymentResponse;
import com.shopmesh.payments.exception.AccessDeniedException;
import com.shopmesh.payments.exception.PaymentNotFoundException;
import com.shopmesh.payments.repository.PaymentRepository;
import com.shopmesh.payments.security.AuthContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/payments")
public class PaymentController {
    private final PaymentRepository paymentRepository;

    public PaymentController(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    @GetMapping("/order/{orderId}")
    public PaymentResponse getByOrderId(@PathVariable UUID orderId,
                                        @RequestAttribute("authContext") AuthContext authContext) {
        var payment = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new PaymentNotFoundException(orderId));
        if (!payment.getUserId().equals(authContext.userId()) && !"ADMIN".equals(authContext.role())) {
            throw new AccessDeniedException();
        }
        return PaymentResponse.from(payment);
    }
}
