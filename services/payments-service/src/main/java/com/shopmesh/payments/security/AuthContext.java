package com.shopmesh.payments.security;

import java.util.UUID;

public record AuthContext(UUID userId, String role) {
}
