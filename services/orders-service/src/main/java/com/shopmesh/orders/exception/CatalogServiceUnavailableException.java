package com.shopmesh.orders.exception;

public class CatalogServiceUnavailableException extends RuntimeException {
    public CatalogServiceUnavailableException() {
        super("Catalog Service indisponível");
    }

    public CatalogServiceUnavailableException(Throwable cause) {
        super("Catalog Service indisponível", cause);
    }
}
