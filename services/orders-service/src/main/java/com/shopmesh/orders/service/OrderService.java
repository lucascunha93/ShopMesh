package com.shopmesh.orders.service;

import com.shopmesh.orders.client.CatalogClient;
import com.shopmesh.orders.client.CatalogProduct;
import com.shopmesh.orders.dto.CreateOrderItemRequest;
import com.shopmesh.orders.dto.CreateOrderRequest;
import com.shopmesh.orders.dto.OrderResponse;
import com.shopmesh.orders.entity.Order;
import com.shopmesh.orders.entity.OrderItem;
import com.shopmesh.orders.entity.OrderStatus;
import com.shopmesh.orders.exception.AccessDeniedException;
import com.shopmesh.orders.exception.InvalidOrderStatusTransitionException;
import com.shopmesh.orders.exception.OrderNotFoundException;
import com.shopmesh.orders.repository.OrderRepository;
import com.shopmesh.orders.security.AuthContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final CatalogClient catalogClient;

    public OrderService(OrderRepository orderRepository, CatalogClient catalogClient) {
        this.orderRepository = orderRepository;
        this.catalogClient = catalogClient;
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
        return OrderResponse.from(orderRepository.saveAndFlush(order));
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
}
