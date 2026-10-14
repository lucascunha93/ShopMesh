package com.shopmesh.payments.exception;

public class AccessDeniedException extends RuntimeException {
    public AccessDeniedException() {
        super("Você não tem permissão para consultar este pagamento");
    }
}
