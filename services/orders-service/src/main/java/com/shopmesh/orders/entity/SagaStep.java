package com.shopmesh.orders.entity;

/**
 * Passo atual da Saga orquestrada pelo Orders. Valor nulo (pedidos antigos)
 * equivale a {@link #DONE}.
 */
public enum SagaStep {
    STOCK_RESERVATION,
    PAYMENT,
    DONE
}
