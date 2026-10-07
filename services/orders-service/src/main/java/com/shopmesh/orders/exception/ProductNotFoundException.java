package com.shopmesh.orders.exception;

public class ProductNotFoundException extends RuntimeException {
    public ProductNotFoundException(String productId) {
        super("Produto não encontrado no catálogo: " + productId);
    }
}
