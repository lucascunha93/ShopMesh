package com.shopmesh.orders.event;

import com.shopmesh.orders.entity.Order;
import com.shopmesh.orders.entity.OrderItem;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderCreatedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        UUID orderId,
        UUID userId,
        BigDecimal totalAmount,
        List<Item> items
) {
    public static OrderCreatedEvent from(Order order) {
        List<Item> items = order.getItems().stream()
                .map(Item::from)
                .toList();
        return new OrderCreatedEvent(
                UUID.randomUUID(),
                "ORDER_CREATED",
                Instant.now(),
                order.getId(),
                order.getUserId(),
                order.getTotalAmount(),
                items
        );
    }

    public record Item(
            String productId,
            Integer quantity,
            BigDecimal unitPrice
    ) {
        private static Item from(OrderItem item) {
            return new Item(item.getProductId(), item.getQuantity(), item.getUnitPrice());
        }
    }
}
