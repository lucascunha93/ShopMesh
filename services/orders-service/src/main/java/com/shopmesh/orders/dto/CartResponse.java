package com.shopmesh.orders.dto;

import java.time.Instant;
import java.util.List;

public record CartResponse(List<CartItemDto> items, Instant updatedAt) {
}
