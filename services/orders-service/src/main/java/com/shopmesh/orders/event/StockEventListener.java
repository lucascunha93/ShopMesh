package com.shopmesh.orders.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopmesh.orders.service.OrderService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class StockEventListener {
    public static final String STOCK_REJECTED_TOPIC = "stock.rejected";

    private final ObjectMapper objectMapper;
    private final OrderService orderService;

    public StockEventListener(ObjectMapper objectMapper, OrderService orderService) {
        this.objectMapper = objectMapper;
        this.orderService = orderService;
    }

    @KafkaListener(topics = STOCK_REJECTED_TOPIC, groupId = "orders-service")
    public void handleStockRejected(String payload) throws JsonProcessingException {
        orderService.handleStockRejected(
                objectMapper.readValue(payload, StockRejectedEvent.class).validate());
    }
}
