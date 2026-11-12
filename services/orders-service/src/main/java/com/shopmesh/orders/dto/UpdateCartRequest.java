package com.shopmesh.orders.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateCartRequest(
        @NotNull @Size(max = 100) List<@NotNull @Valid CartItemDto> items
) {
}
