package com.shopmesh.orders.service;

import com.shopmesh.orders.client.CatalogClient;
import com.shopmesh.orders.entity.Order;
import com.shopmesh.orders.entity.OrderStatus;
import com.shopmesh.orders.entity.SagaStep;
import com.shopmesh.orders.event.OrderCancelledDomainEvent;
import com.shopmesh.orders.event.OrderConfirmedEvent;
import com.shopmesh.orders.event.SagaMessage;
import com.shopmesh.orders.event.StockCommitRequestedEvent;
import com.shopmesh.orders.event.StockReleaseRequestedEvent;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
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
    void manualCancellationPublishesOrderCancelledAndStockRelease() {
        Order order = order(OrderStatus.PENDING, SagaStep.PAYMENT);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.updateStatus(order.getId(), OrderStatus.CANCELLED);

        List<Object> events = publishedEvents(2);
        OrderCancelledDomainEvent cancelled = events.stream()
                .filter(OrderCancelledDomainEvent.class::isInstance)
                .map(OrderCancelledDomainEvent.class::cast)
                .findFirst().orElseThrow();
        assertEquals(order.getId(), cancelled.event().orderId());
        assertEquals("ORDER_CANCELLED", cancelled.event().eventType());

        List<SagaMessage> messages = sagaMessages(events);
        assertEquals(1, messages.size());
        assertEquals(SagaMessage.STOCK_RELEASE_TOPIC, messages.get(0).topic());
        assertEquals(order.getId(), messages.get(0).orderId());
        StockReleaseRequestedEvent release = assertInstanceOf(StockReleaseRequestedEvent.class,
                messages.get(0).payload());
        assertEquals("STOCK_RELEASE_REQUESTED", release.eventType());
        assertEquals(order.getUserId(), release.userId());
        assertEquals(SagaStep.DONE, order.getSagaStep());
    }

    @Test
    void manualCancellationDuringStockReservationAlsoReleasesStock() {
        Order order = order(OrderStatus.PENDING, SagaStep.STOCK_RESERVATION);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.updateStatus(order.getId(), OrderStatus.CANCELLED);

        List<SagaMessage> messages = sagaMessages(publishedEvents(2));
        assertEquals(List.of(SagaMessage.STOCK_RELEASE_TOPIC), messages.stream().map(SagaMessage::topic).toList());
    }

    @Test
    void manualConfirmationDuringPaymentCommitsStock() {
        Order order = order(OrderStatus.PENDING, SagaStep.PAYMENT);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.updateStatus(order.getId(), OrderStatus.CONFIRMED);

        List<Object> events = publishedEvents(2);
        assertTrue(events.stream().noneMatch(OrderCancelledDomainEvent.class::isInstance));
        List<SagaMessage> messages = sagaMessages(events);
        assertEquals(List.of(SagaMessage.STOCK_COMMIT_TOPIC, SagaMessage.ORDER_CONFIRMED_TOPIC),
                messages.stream().map(SagaMessage::topic).toList());
        assertInstanceOf(StockCommitRequestedEvent.class, messages.get(0).payload());
        OrderConfirmedEvent confirmed = assertInstanceOf(OrderConfirmedEvent.class, messages.get(1).payload());
        assertEquals("ORDER_CONFIRMED", confirmed.eventType());
        assertEquals(order.getId(), confirmed.orderId());
        assertEquals(order.getUserId(), confirmed.userId());
        assertEquals(0, order.getTotalAmount().compareTo(confirmed.totalAmount()));
        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        assertEquals(SagaStep.DONE, order.getSagaStep());
    }

    @Test
    void manualConfirmationDuringStockReservationOnlyPublishesOrderConfirmed() {
        Order order = order(OrderStatus.PENDING, SagaStep.STOCK_RESERVATION);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);

        orderService.updateStatus(order.getId(), OrderStatus.CONFIRMED);

        List<SagaMessage> messages = sagaMessages(publishedEvents(1));
        assertEquals(List.of(SagaMessage.ORDER_CONFIRMED_TOPIC), messages.stream().map(SagaMessage::topic).toList());
        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
    }

    @Test
    void finalizedOrderCannotBeCancelledAgain() {
        Order order = order(OrderStatus.CONFIRMED, SagaStep.DONE);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        assertThrows(InvalidOrderStatusTransitionException.class,
                () -> orderService.updateStatus(order.getId(), OrderStatus.CANCELLED));

        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    private List<Object> publishedEvents(int expected) {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher, atLeast(expected)).publishEvent(captor.capture());
        assertEquals(expected, captor.getAllValues().size());
        return captor.getAllValues();
    }

    private List<SagaMessage> sagaMessages(List<Object> events) {
        return events.stream()
                .filter(SagaMessage.class::isInstance)
                .map(SagaMessage.class::cast)
                .toList();
    }

    private Order order(OrderStatus status, SagaStep step) {
        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setUserId(UUID.randomUUID());
        order.setStatus(status);
        order.setSagaStep(step);
        order.setTotalAmount(new BigDecimal("100.00"));
        return order;
    }
}
