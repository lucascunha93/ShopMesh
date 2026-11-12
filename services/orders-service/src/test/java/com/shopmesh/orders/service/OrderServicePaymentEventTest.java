package com.shopmesh.orders.service;

import com.shopmesh.orders.client.CatalogClient;
import com.shopmesh.orders.entity.Order;
import com.shopmesh.orders.entity.OrderStatus;
import com.shopmesh.orders.entity.SagaStep;
import com.shopmesh.orders.event.InvalidEventException;
import com.shopmesh.orders.event.OrderConfirmedEvent;
import com.shopmesh.orders.event.PaymentApprovedEvent;
import com.shopmesh.orders.event.PaymentRefundRequestedEvent;
import com.shopmesh.orders.event.PaymentRejectedEvent;
import com.shopmesh.orders.event.PaymentRequestedEvent;
import com.shopmesh.orders.event.SagaMessage;
import com.shopmesh.orders.event.StockCommitRequestedEvent;
import com.shopmesh.orders.event.StockRejectedEvent;
import com.shopmesh.orders.event.StockReleaseRequestedEvent;
import com.shopmesh.orders.event.StockReservedEvent;
import com.shopmesh.orders.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServicePaymentEventTest {
    private static final String REFUND_REASON = "Pedido cancelado antes da confirmação do pagamento";

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private CatalogClient catalogClient;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private OrderService orderService;

    @Test
    void paymentApprovedConfirmsPendingOrderAndCommitsStock() {
        Order order = pendingOrder(SagaStep.PAYMENT);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handlePaymentApproved(paymentApprovedEvent(order.getId()));

        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        assertEquals(SagaStep.DONE, order.getSagaStep());
        verify(orderRepository).saveAndFlush(order);
        List<SagaMessage> messages = published(2);
        assertEquals(SagaMessage.STOCK_COMMIT_TOPIC, messages.get(0).topic());
        assertEquals(order.getId(), messages.get(0).orderId());
        StockCommitRequestedEvent commit = assertInstanceOf(StockCommitRequestedEvent.class, messages.get(0).payload());
        assertEquals("STOCK_COMMIT_REQUESTED", commit.eventType());
        assertEquals(order.getUserId(), commit.userId());
        assertEquals(SagaMessage.ORDER_CONFIRMED_TOPIC, messages.get(1).topic());
        assertEquals(order.getId(), messages.get(1).orderId());
        OrderConfirmedEvent confirmed = assertInstanceOf(OrderConfirmedEvent.class, messages.get(1).payload());
        assertEquals("ORDER_CONFIRMED", confirmed.eventType());
        assertEquals(order.getUserId(), confirmed.userId());
        assertEquals(0, order.getTotalAmount().compareTo(confirmed.totalAmount()));
    }

    @Test
    void paymentApprovedForCancelledOrderRequestsRefundAndReleasesStock() {
        Order order = pendingOrder(SagaStep.DONE);
        order.setStatus(OrderStatus.CANCELLED);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handlePaymentApproved(paymentApprovedEvent(order.getId()));

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        verify(orderRepository, never()).saveAndFlush(order);
        List<SagaMessage> messages = published(2);
        assertEquals(SagaMessage.PAYMENT_REFUND_REQUESTED_TOPIC, messages.get(0).topic());
        PaymentRefundRequestedEvent refund = assertInstanceOf(PaymentRefundRequestedEvent.class,
                messages.get(0).payload());
        assertEquals("PAYMENT_REFUND_REQUESTED", refund.eventType());
        assertEquals(REFUND_REASON, refund.reason());
        assertEquals(order.getUserId(), refund.userId());
        assertEquals(SagaMessage.STOCK_RELEASE_TOPIC, messages.get(1).topic());
        assertInstanceOf(StockReleaseRequestedEvent.class, messages.get(1).payload());
    }

    @Test
    void paymentRejectedCancelsPendingOrderStoresReasonAndReleasesStock() {
        Order order = pendingOrder(SagaStep.PAYMENT);
        String reason = "Limite de pagamento excedido";
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handlePaymentRejected(paymentRejectedEvent(order.getId(), reason));

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        assertEquals(reason, order.getStatusReason());
        assertEquals(SagaStep.DONE, order.getSagaStep());
        verify(orderRepository).saveAndFlush(order);
        List<SagaMessage> messages = published(1);
        assertEquals(SagaMessage.STOCK_RELEASE_TOPIC, messages.get(0).topic());
        StockReleaseRequestedEvent release = assertInstanceOf(StockReleaseRequestedEvent.class,
                messages.get(0).payload());
        assertEquals(reason, release.reason());
    }

    @Test
    void repeatedPaymentApprovedDoesNotChangeOrderAgain() {
        Order order = pendingOrder(SagaStep.PAYMENT);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        PaymentApprovedEvent event = paymentApprovedEvent(order.getId());

        orderService.handlePaymentApproved(event);
        orderService.handlePaymentApproved(event);

        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        verify(orderRepository).saveAndFlush(order);
        published(2);
    }

    @Test
    void paymentEventForConfirmedOrderIsIgnored() {
        Order order = pendingOrder(SagaStep.DONE);
        order.setStatus(OrderStatus.CONFIRMED);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handlePaymentApproved(paymentApprovedEvent(order.getId()));

        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        verify(orderRepository, never()).saveAndFlush(order);
        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    void paymentRejectedForNonPendingOrderIsIgnored() {
        Order order = pendingOrder(SagaStep.DONE);
        order.setStatus(OrderStatus.CONFIRMED);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handlePaymentRejected(paymentRejectedEvent(order.getId(), "x"));

        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    void paymentEventForUnknownOrderIsIgnored() {
        UUID orderId = UUID.randomUUID();
        when(orderRepository.findById(orderId)).thenReturn(Optional.empty());

        orderService.handlePaymentRejected(paymentRejectedEvent(orderId, "Pagamento rejeitado"));

        verify(orderRepository, never()).saveAndFlush(any(Order.class));
        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    void stockReservedMovesPendingOrderToPaymentAndRequestsPayment() {
        Order order = pendingOrder(SagaStep.STOCK_RESERVATION);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handleStockReserved(stockReservedEvent(order.getId()));

        assertEquals(SagaStep.PAYMENT, order.getSagaStep());
        assertEquals(OrderStatus.PENDING, order.getStatus());
        verify(orderRepository).saveAndFlush(order);
        List<SagaMessage> messages = published(1);
        assertEquals(SagaMessage.PAYMENT_REQUESTED_TOPIC, messages.get(0).topic());
        PaymentRequestedEvent request = assertInstanceOf(PaymentRequestedEvent.class, messages.get(0).payload());
        assertEquals("PAYMENT_REQUESTED", request.eventType());
        assertEquals(order.getUserId(), request.userId());
        assertEquals(0, order.getTotalAmount().compareTo(request.amount()));
    }

    @Test
    void repeatedStockReservedResendsPaymentRequest() {
        Order order = pendingOrder(SagaStep.PAYMENT);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handleStockReserved(stockReservedEvent(order.getId()));

        assertEquals(SagaStep.PAYMENT, order.getSagaStep());
        verify(orderRepository, never()).saveAndFlush(order);
        List<SagaMessage> messages = published(1);
        assertEquals(SagaMessage.PAYMENT_REQUESTED_TOPIC, messages.get(0).topic());
    }

    @Test
    void stockReservedForCancelledOrderReleasesStock() {
        Order order = pendingOrder(SagaStep.DONE);
        order.setStatus(OrderStatus.CANCELLED);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handleStockReserved(stockReservedEvent(order.getId()));

        verify(orderRepository, never()).saveAndFlush(order);
        List<SagaMessage> messages = published(1);
        assertEquals(SagaMessage.STOCK_RELEASE_TOPIC, messages.get(0).topic());
        assertInstanceOf(StockReleaseRequestedEvent.class, messages.get(0).payload());
    }

    @Test
    void stockReservedForManuallyConfirmedOrderCommitsStock() {
        Order order = pendingOrder(SagaStep.DONE);
        order.setStatus(OrderStatus.CONFIRMED);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handleStockReserved(stockReservedEvent(order.getId()));

        List<SagaMessage> messages = published(1);
        assertEquals(SagaMessage.STOCK_COMMIT_TOPIC, messages.get(0).topic());
        assertInstanceOf(StockCommitRequestedEvent.class, messages.get(0).payload());
    }

    @Test
    void stockReservedForUnknownOrderIsIgnored() {
        UUID orderId = UUID.randomUUID();
        when(orderRepository.findById(orderId)).thenReturn(Optional.empty());

        orderService.handleStockReserved(stockReservedEvent(orderId));

        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    void stockRejectedCancelsPendingOrderAndStoresReason() {
        Order order = pendingOrder(SagaStep.STOCK_RESERVATION);
        String reason = "Estoque insuficiente para Teclado Mecanico (solicitado: 20, disponível: 15)";
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handleStockRejected(stockRejectedEvent(order.getId(), reason));

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        assertEquals(reason, order.getStatusReason());
        assertEquals(SagaStep.DONE, order.getSagaStep());
        verify(orderRepository).saveAndFlush(order);
        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    void stockRejectedForCancelledOrderIsIgnored() {
        Order order = pendingOrder(SagaStep.DONE);
        order.setStatus(OrderStatus.CANCELLED);
        order.setStatusReason("motivo original");
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.handleStockRejected(stockRejectedEvent(order.getId(), "outro motivo"));

        assertEquals("motivo original", order.getStatusReason());
        verify(orderRepository, never()).saveAndFlush(order);
    }

    @Test
    void invalidStockRejectedEventIsDetected() {
        StockRejectedEvent event = new StockRejectedEvent(UUID.randomUUID(), "STOCK_REJECTED",
                Instant.parse("2026-10-07T03:20:06.021Z"), null, UUID.randomUUID(), "x");
        assertThrows(InvalidEventException.class, event::validate);
    }

    @Test
    void invalidStockReservedEventIsDetected() {
        StockReservedEvent event = new StockReservedEvent(UUID.randomUUID(), "OUTRO",
                Instant.parse("2026-10-07T03:20:06.021Z"), UUID.randomUUID());
        assertThrows(InvalidEventException.class, event::validate);
    }

    private List<SagaMessage> published(int expected) {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher, atLeast(expected)).publishEvent(captor.capture());
        assertEquals(expected, captor.getAllValues().size());
        return captor.getAllValues().stream().map(SagaMessage.class::cast).toList();
    }

    private StockReservedEvent stockReservedEvent(UUID orderId) {
        return new StockReservedEvent(UUID.randomUUID(), "STOCK_RESERVED",
                Instant.parse("2026-10-07T03:20:06.021Z"), orderId);
    }

    private StockRejectedEvent stockRejectedEvent(UUID orderId, String reason) {
        return new StockRejectedEvent(
                UUID.randomUUID(),
                "STOCK_REJECTED",
                Instant.parse("2026-10-07T03:20:06.021Z"),
                orderId,
                UUID.randomUUID(),
                reason
        );
    }

    private Order pendingOrder(SagaStep step) {
        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setUserId(UUID.randomUUID());
        order.setStatus(OrderStatus.PENDING);
        order.setSagaStep(step);
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
