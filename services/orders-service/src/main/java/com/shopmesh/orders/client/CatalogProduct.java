package com.shopmesh.orders.client;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record CatalogProduct(
        @JsonProperty("_id") String id,
        String name,
        BigDecimal price,
        Integer stock
) {
}
