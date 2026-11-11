package com.shopmesh.orders.service;

import com.shopmesh.orders.client.CatalogClient;
import com.shopmesh.orders.entity.Order;
import com.shopmesh.orders.entity.OrderStatus;
import com.shopmesh.orders.event.OrderCancelledDomainEvent;
import com.shopmesh.orders.exception.InvalidOrderStatusTransitionException;
import com.shopmesh.orders.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceUpdateStatusTest {
    @Mock
    private OrderRepository orderRepository;

    @Mock
    private CatalogClient catalogClient;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private OrderService orderService;

    @Test
    void manualCancellationPublishesOrderCancelledEvent() {
        Order order = order(OrderStatus.PENDING);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.updateStatus(order.getId(), OrderStatus.CANCELLED);

        ArgumentCaptor<OrderCancelledDomainEvent> captor = ArgumentCaptor.forClass(OrderCancelledDomainEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertEquals(order.getId(), captor.getValue().event().orderId());
        assertEquals("ORDER_CANCELLED", captor.getValue().event().eventType());
    }

    @Test
    void manualConfirmationDoesNotPublishCancellation() {
        Order order = order(OrderStatus.PENDING);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.updateStatus(order.getId(), OrderStatus.CONFIRMED);

        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    void finalizedOrderCannotBeCancelledAgain() {
        Order order = order(OrderStatus.CONFIRMED);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        assertThrows(InvalidOrderStatusTransitionException.class,
                () -> orderService.updateStatus(order.getId(), OrderStatus.CANCELLED));

        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    private Order order(OrderStatus status) {
        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setUserId(UUID.randomUUID());
        order.setStatus(status);
        order.setTotalAmount(new BigDecimal("100.00"));
        return order;
    }
}
