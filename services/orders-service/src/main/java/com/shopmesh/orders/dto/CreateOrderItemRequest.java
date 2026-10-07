package com.shopmesh.orders.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateOrderItemRequest(
        @NotBlank String productId,
        @NotNull @Min(1) Integer quantity
) {
}
