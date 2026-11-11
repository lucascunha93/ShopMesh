package com.shopmesh.orders.event;

/**
 * Evento com JSON válido, mas sem campos obrigatórios do contrato. Não é
 * retentado: vai direto para a DLT do tópico de origem.
 */
public class InvalidEventException extends RuntimeException {
    public InvalidEventException(String message) {
        super(message);
    }
}
