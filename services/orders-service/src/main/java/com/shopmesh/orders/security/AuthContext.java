package com.shopmesh.orders.security;

import java.util.UUID;

public record AuthContext(UUID userId, String role) {
}
