package com.shopmesh.orders.service;

import com.shopmesh.orders.client.CatalogClient;
import com.shopmesh.orders.client.CatalogProduct;
import com.shopmesh.orders.dto.CreateOrderItemRequest;
import com.shopmesh.orders.dto.CreateOrderRequest;
import com.shopmesh.orders.dto.OrderResponse;
import com.shopmesh.orders.entity.Order;
import com.shopmesh.orders.entity.OrderItem;
import com.shopmesh.orders.entity.OrderStatus;
import com.shopmesh.orders.event.OrderCreatedDomainEvent;
import com.shopmesh.orders.event.OrderCreatedEvent;
import com.shopmesh.orders.event.PaymentApprovedEvent;
import com.shopmesh.orders.event.PaymentRejectedEvent;
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
        Order savedOrder = orderRepository.saveAndFlush(order);
        eventPublisher.publishEvent(new OrderCreatedDomainEvent(OrderCreatedEvent.from(savedOrder)));
        return OrderResponse.from(savedOrder);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> listForUser(UUID userId, Pageable pageable) {
        return orderRepository.findByUserId(userId, pageable).map(OrderResponse::from);
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

        order.setStatus(newStatus);
        return OrderResponse.from(orderRepository.saveAndFlush(order));
    }

    @Transactional
    public void handlePaymentApproved(PaymentApprovedEvent event) {
        orderRepository.findById(event.orderId()).ifPresentOrElse(order -> {
            if (order.getStatus() != OrderStatus.PENDING) {
                logIgnoredPaymentEvent(order);
                return;
            }

            order.setStatus(OrderStatus.CONFIRMED);
            orderRepository.saveAndFlush(order);
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
            orderRepository.saveAndFlush(order);
        }, () -> LOGGER.warn("Evento payment.rejected ignorado: pedido {} não encontrado", event.orderId()));
    }

    private void logIgnoredPaymentEvent(Order order) {
        LOGGER.info("evento ignorado: pedido já está {}", order.getStatus());
    }
}
