package com.shopmesh.orders.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CartItemDto(
        @NotBlank String productId,
        @NotBlank String name,
        @NotNull @DecimalMin("0") BigDecimal price,
        @NotBlank String category,
        String imageUrl,
        @NotNull @Min(1) @Max(999) Integer quantity
) {
}
