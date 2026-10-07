package com.shopmesh.orders.exception;

public class InvalidOrderStatusTransitionException extends RuntimeException {
    public InvalidOrderStatusTransitionException(String currentStatus) {
        super("Não é possível alterar o status de um pedido " + currentStatus);
    }
}
