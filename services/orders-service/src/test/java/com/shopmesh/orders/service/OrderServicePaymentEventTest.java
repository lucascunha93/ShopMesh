package com.shopmesh.orders.service;

import com.shopmesh.orders.client.CatalogClient;
import com.shopmesh.orders.entity.Order;
import com.shopmesh.orders.entity.OrderStatus;
import com.shopmesh.orders.event.PaymentApprovedEvent;
import com.shopmesh.orders.event.PaymentRejectedEvent;
import com.shopmesh.orders.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServicePaymentEventTest {
    @Mock
    private OrderRepository orderRepository;

    @Mock
    private CatalogClient catalogClient;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private OrderService orderService;

    @Test
    void paymentApprovedConfirmsPendingOrder() {
        Order order = pendingOrder();
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handlePaymentApproved(paymentApprovedEvent(order.getId()));

        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        verify(orderRepository).saveAndFlush(order);
    }

    @Test
    void paymentRejectedCancelsPendingOrderAndStoresReason() {
        Order order = pendingOrder();
        String reason = "Limite de pagamento excedido";
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handlePaymentRejected(paymentRejectedEvent(order.getId(), reason));

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        assertEquals(reason, order.getStatusReason());
        verify(orderRepository).saveAndFlush(order);
    }

    @Test
    void repeatedPaymentEventDoesNotChangeOrderAgain() {
        Order order = pendingOrder();
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        PaymentApprovedEvent event = paymentApprovedEvent(order.getId());

        orderService.handlePaymentApproved(event);
        orderService.handlePaymentApproved(event);

        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        verify(orderRepository).saveAndFlush(order);
    }

    @Test
    void paymentEventForConfirmedOrderIsIgnored() {
        Order order = pendingOrder();
        order.setStatus(OrderStatus.CONFIRMED);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handlePaymentApproved(paymentApprovedEvent(order.getId()));

        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        verify(orderRepository, never()).saveAndFlush(order);
    }

    @Test
    void paymentEventForUnknownOrderIsIgnored() {
        UUID orderId = UUID.randomUUID();
        when(orderRepository.findById(orderId)).thenReturn(Optional.empty());

        orderService.handlePaymentRejected(paymentRejectedEvent(orderId, "Pagamento rejeitado"));

        verify(orderRepository, never()).saveAndFlush(org.mockito.ArgumentMatchers.any(Order.class));
    }

    private Order pendingOrder() {
        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setStatus(OrderStatus.PENDING);
        order.setTotalAmount(new BigDecimal("100.00"));
        return order;
    }

    private PaymentApprovedEvent paymentApprovedEvent(UUID orderId) {
        return new PaymentApprovedEvent(
                UUID.randomUUID(),
                "PAYMENT_APPROVED",
                Instant.parse("2026-10-07T03:20:06.021Z"),
                orderId,
                UUID.randomUUID(),
                UUID.randomUUID(),
                new BigDecimal("100.00")
        );
    }

    private PaymentRejectedEvent paymentRejectedEvent(UUID orderId, String reason) {
        return new PaymentRejectedEvent(
                UUID.randomUUID(),
                "PAYMENT_REJECTED",
                Instant.parse("2026-10-07T03:20:06.021Z"),
                orderId,
                UUID.randomUUID(),
                UUID.randomUUID(),
                new BigDecimal("100.00"),
                reason
        );
    }
}
