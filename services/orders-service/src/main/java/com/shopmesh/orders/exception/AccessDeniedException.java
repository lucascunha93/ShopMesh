package com.shopmesh.orders.exception;

public class AccessDeniedException extends RuntimeException {
    public AccessDeniedException() {
        super("Você não tem permissão para acessar este pedido");
    }
}
