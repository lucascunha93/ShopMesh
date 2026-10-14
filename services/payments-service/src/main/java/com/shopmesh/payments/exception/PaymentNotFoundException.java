package com.shopmesh.payments.exception;

import java.util.UUID;

public class PaymentNotFoundException extends RuntimeException {
    public PaymentNotFoundException(UUID orderId) {
        super("Pagamento do pedido " + orderId + " não encontrado");
    }
}
