package com.shopmesh.orders.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopmesh.orders.dto.ApiError;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final String AUTH_CONTEXT_ATTRIBUTE = "authContext";
    private static final String INVALID_TOKEN_MESSAGE = "Token ausente ou inválido";

    private final SecretKey signingKey;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(@Value("${jwt.secret}") String secret, ObjectMapper objectMapper) {
        this.signingKey = secret.startsWith("base64:")
                ? Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret.substring("base64:".length())))
                : Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return !path.equals("/orders") && !path.startsWith("/orders/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")
                || authorization.substring("Bearer ".length()).isBlank()) {
            writeUnauthorized(response);
            return;
        }

        try {
            Jws<Claims> parsedToken = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(authorization.substring("Bearer ".length()));
            if (!"HS256".equals(parsedToken.getHeader().getAlgorithm())) {
                writeUnauthorized(response);
                return;
            }

            Claims claims = parsedToken.getPayload();
            UUID userId = UUID.fromString(claims.getSubject());
            String role = claims.get("role", String.class);
            if (role == null || role.isBlank()) {
                writeUnauthorized(response);
                return;
            }

            request.setAttribute(AUTH_CONTEXT_ATTRIBUTE, new AuthContext(userId, role));
            filterChain.doFilter(request, response);
        } catch (JwtException | IllegalArgumentException exception) {
            writeUnauthorized(response);
        }
    }

    private void writeUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), new ApiError(INVALID_TOKEN_MESSAGE));
    }
}
