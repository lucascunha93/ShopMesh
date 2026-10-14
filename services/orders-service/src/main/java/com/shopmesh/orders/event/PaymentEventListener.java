package com.shopmesh.orders.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopmesh.orders.service.OrderService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class PaymentEventListener {
    private static final String PAYMENT_APPROVED_TOPIC = "payment.approved";
    private static final String PAYMENT_REJECTED_TOPIC = "payment.rejected";

    private final ObjectMapper objectMapper;
    private final OrderService orderService;

    public PaymentEventListener(ObjectMapper objectMapper, OrderService orderService) {
        this.objectMapper = objectMapper;
        this.orderService = orderService;
    }

    @KafkaListener(topics = PAYMENT_APPROVED_TOPIC, groupId = "orders-service")
    public void handlePaymentApproved(String payload) throws JsonProcessingException {
        orderService.handlePaymentApproved(objectMapper.readValue(payload, PaymentApprovedEvent.class));
    }

    @KafkaListener(topics = PAYMENT_REJECTED_TOPIC, groupId = "orders-service")
    public void handlePaymentRejected(String payload) throws JsonProcessingException {
        orderService.handlePaymentRejected(objectMapper.readValue(payload, PaymentRejectedEvent.class));
    }
}
