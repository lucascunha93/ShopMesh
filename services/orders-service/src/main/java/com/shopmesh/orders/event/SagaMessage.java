package com.shopmesh.orders.event;

import java.util.UUID;

/**
 * Comando da Saga a ser publicado no Kafka após o commit da transação.
 * A chave da mensagem é sempre o orderId.
 */
public record SagaMessage(String topic, UUID orderId, Object payload) {
    public static final String PAYMENT_REQUESTED_TOPIC = "payment.requested";
    public static final String ORDER_CONFIRMED_TOPIC = "order.confirmed";
    public static final String STOCK_COMMIT_TOPIC = "stock.commit";
    public static final String STOCK_RELEASE_TOPIC = "stock.release";
    public static final String PAYMENT_REFUND_REQUESTED_TOPIC = "payment.refund.requested";
}
