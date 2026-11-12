package com.shopmesh.orders.service;

import com.shopmesh.orders.client.CatalogClient;
import com.shopmesh.orders.client.CatalogProduct;
import com.shopmesh.orders.dto.CreateOrderItemRequest;
import com.shopmesh.orders.dto.CreateOrderRequest;
import com.shopmesh.orders.dto.OrderResponse;
import com.shopmesh.orders.entity.Order;
import com.shopmesh.orders.entity.OrderItem;
import com.shopmesh.orders.entity.OrderStatus;
import com.shopmesh.orders.entity.SagaStep;
import com.shopmesh.orders.event.OrderCancelledDomainEvent;
import com.shopmesh.orders.event.OrderCancelledEvent;
import com.shopmesh.orders.event.OrderConfirmedEvent;
import com.shopmesh.orders.event.OrderCreatedDomainEvent;
import com.shopmesh.orders.event.OrderCreatedEvent;
import com.shopmesh.orders.event.PaymentApprovedEvent;
import com.shopmesh.orders.event.PaymentRefundRequestedEvent;
import com.shopmesh.orders.event.PaymentRejectedEvent;
import com.shopmesh.orders.event.PaymentRequestedEvent;
import com.shopmesh.orders.event.SagaMessage;
import com.shopmesh.orders.event.StockCommitRequestedEvent;
import com.shopmesh.orders.event.StockRejectedEvent;
import com.shopmesh.orders.event.StockReleaseRequestedEvent;
import com.shopmesh.orders.event.StockReservedEvent;
import com.shopmesh.orders.exception.AccessDeniedException;
import com.shopmesh.orders.exception.InvalidOrderStatusTransitionException;
import com.shopmesh.orders.exception.OrderNotFoundException;
import com.shopmesh.orders.repository.OrderRepository;
import com.shopmesh.orders.security.AuthContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
public class OrderService {
    private static final Logger LOGGER = LoggerFactory.getLogger(OrderService.class);
    private static final String REFUND_REASON = "Pedido cancelado antes da confirmação do pagamento";

    private final OrderRepository orderRepository;
    private final CatalogClient catalogClient;
    private final ApplicationEventPublisher eventPublisher;

    public OrderService(OrderRepository orderRepository,
                        CatalogClient catalogClient,
                        ApplicationEventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.catalogClient = catalogClient;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public OrderResponse create(CreateOrderRequest request, UUID userId) {
        Order order = new Order();
        order.setUserId(userId);
        order.setStatus(OrderStatus.PENDING);
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (CreateOrderItemRequest requestedItem : request.items()) {
            CatalogProduct product = catalogClient.getProduct(requestedItem.productId());
            OrderItem item = new OrderItem();
            item.setProductId(product.id());
            item.setProductName(product.name());
            item.setUnitPrice(product.price());
            item.setQuantity(requestedItem.quantity());
            item.setSubtotal(product.price().multiply(BigDecimal.valueOf(requestedItem.quantity())));
            order.addItem(item);
            totalAmount = totalAmount.add(item.getSubtotal());
        }

        order.setTotalAmount(totalAmount);
        order.setSagaStep(SagaStep.STOCK_RESERVATION);
        Order savedOrder = orderRepository.saveAndFlush(order);
        eventPublisher.publishEvent(new OrderCreatedDomainEvent(OrderCreatedEvent.from(savedOrder)));
        return OrderResponse.from(savedOrder);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> listForUser(UUID userId, Pageable pageable) {
        return orderRepository.findByUserId(userId, pageable).map(OrderResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> listAll(OrderStatus status, Pageable pageable) {
        Page<Order> orders = status == null
                ? orderRepository.findAll(pageable)
                : orderRepository.findByStatus(status, pageable);
        return orders.map(OrderResponse::from);
    }

    @Transactional(readOnly = true)
    public OrderResponse getById(UUID orderId, AuthContext authContext) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));

        if (!order.getUserId().equals(authContext.userId()) && !"ADMIN".equals(authContext.role())) {
            throw new AccessDeniedException();
        }
        return OrderResponse.from(order);
    }

    @Transactional
    public OrderResponse updateStatus(UUID orderId, OrderStatus newStatus) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));

        if (order.getStatus() != OrderStatus.PENDING || newStatus == OrderStatus.PENDING) {
            throw new InvalidOrderStatusTransitionException(order.getStatus().name());
        }

        SagaStep previousStep = order.getSagaStep();
        order.setStatus(newStatus);
        order.setSagaStep(SagaStep.DONE);
        Order savedOrder = orderRepository.saveAndFlush(order);
        if (newStatus == OrderStatus.CANCELLED) {
            // Cancelamento manual avisa as notificações e libera a reserva (se já existir ou vier a existir).
            // Se o pagamento estiver em andamento, o estorno só ocorre quando payment.approved chegar.
            eventPublisher.publishEvent(new OrderCancelledDomainEvent(OrderCancelledEvent.from(savedOrder)));
            publishStockRelease(savedOrder, savedOrder.getStatusReason());
        } else if (previousStep == SagaStep.PAYMENT) {
            // Com o passo STOCK_RESERVATION nada é feito aqui: o commit sai em stock.reserved.
            publish(SagaMessage.STOCK_COMMIT_TOPIC, savedOrder, StockCommitRequestedEvent.from(savedOrder));
        }
        if (newStatus == OrderStatus.CONFIRMED) {
            publishOrderConfirmed(savedOrder);
        }
        return OrderResponse.from(savedOrder);
    }

    @Transactional
    public void handleStockReserved(StockReservedEvent event) {
        orderRepository.findById(event.orderId()).ifPresentOrElse(order -> {
            switch (order.getStatus()) {
                case PENDING -> {
                    if (order.getSagaStep() == SagaStep.STOCK_RESERVATION) {
                        order.setSagaStep(SagaStep.PAYMENT);
                        orderRepository.saveAndFlush(order);
                        requestPayment(order);
                    } else if (order.getSagaStep() == SagaStep.PAYMENT) {
                        // Reentrega: o Payments é idempotente, então reenviar o comando é seguro.
                        requestPayment(order);
                    } else {
                        logIgnoredPaymentEvent(order);
                    }
                }
                // Cancelado manualmente antes da reserva: devolve o estoque recém-reservado.
                case CANCELLED -> publishStockRelease(order, order.getStatusReason());
                // Confirmado manualmente antes da reserva: efetiva a baixa.
                case CONFIRMED -> publish(SagaMessage.STOCK_COMMIT_TOPIC, order,
                        StockCommitRequestedEvent.from(order));
            }
        }, () -> LOGGER.warn("Evento stock.reserved ignorado: pedido {} não encontrado", event.orderId()));
    }

    @Transactional
    public void handlePaymentApproved(PaymentApprovedEvent event) {
        orderRepository.findById(event.orderId()).ifPresentOrElse(order -> {
            if (order.getStatus() == OrderStatus.CANCELLED) {
                // Cancelado manualmente enquanto o pagamento corria: devolve o dinheiro e o estoque.
                publish(SagaMessage.PAYMENT_REFUND_REQUESTED_TOPIC, order,
                        PaymentRefundRequestedEvent.from(order, REFUND_REASON));
                publishStockRelease(order, REFUND_REASON);
                return;
            }
            if (order.getStatus() != OrderStatus.PENDING) {
                logIgnoredPaymentEvent(order);
                return;
            }

            order.setStatus(OrderStatus.CONFIRMED);
            order.setSagaStep(SagaStep.DONE);
            orderRepository.saveAndFlush(order);
            publish(SagaMessage.STOCK_COMMIT_TOPIC, order, StockCommitRequestedEvent.from(order));
            publishOrderConfirmed(order);
        }, () -> LOGGER.warn("Evento payment.approved ignorado: pedido {} não encontrado", event.orderId()));
    }

    @Transactional
    public void handlePaymentRejected(PaymentRejectedEvent event) {
        orderRepository.findById(event.orderId()).ifPresentOrElse(order -> {
            if (order.getStatus() != OrderStatus.PENDING) {
                logIgnoredPaymentEvent(order);
                return;
            }

            order.setStatus(OrderStatus.CANCELLED);
            order.setStatusReason(event.reason());
            order.setSagaStep(SagaStep.DONE);
            orderRepository.saveAndFlush(order);
            publishStockRelease(order, event.reason());
        }, () -> LOGGER.warn("Evento payment.rejected ignorado: pedido {} não encontrado", event.orderId()));
    }

    @Transactional
    public void handleStockRejected(StockRejectedEvent event) {
        orderRepository.findById(event.orderId()).ifPresentOrElse(order -> {
            if (order.getStatus() != OrderStatus.PENDING) {
                logIgnoredPaymentEvent(order);
                return;
            }

            order.setStatus(OrderStatus.CANCELLED);
            order.setStatusReason(event.reason() == null || event.reason().isBlank()
                    ? "Estoque indisponível"
                    : event.reason());
            order.setSagaStep(SagaStep.DONE);
            orderRepository.saveAndFlush(order);
        }, () -> LOGGER.warn("Evento stock.rejected ignorado: pedido {} não encontrado", event.orderId()));
    }

    private void publishOrderConfirmed(Order order) {
        publish(SagaMessage.ORDER_CONFIRMED_TOPIC, order, OrderConfirmedEvent.from(order));
    }

    private void requestPayment(Order order) {
        publish(SagaMessage.PAYMENT_REQUESTED_TOPIC, order, PaymentRequestedEvent.from(order));
    }

    private void publishStockRelease(Order order, String reason) {
        publish(SagaMessage.STOCK_RELEASE_TOPIC, order, StockReleaseRequestedEvent.from(order, reason));
    }

    private void publish(String topic, Order order, Object payload) {
        eventPublisher.publishEvent(new SagaMessage(topic, order.getId(), payload));
    }

    private void logIgnoredPaymentEvent(Order order) {
        LOGGER.info("evento ignorado: pedido já está {}", order.getStatus());
    }
}
