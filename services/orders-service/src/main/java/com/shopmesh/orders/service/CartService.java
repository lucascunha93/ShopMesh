package com.shopmesh.orders.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopmesh.orders.dto.CartItemDto;
import com.shopmesh.orders.dto.CartResponse;
import com.shopmesh.orders.entity.Cart;
import com.shopmesh.orders.exception.InvalidCartException;
import com.shopmesh.orders.repository.CartRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class CartService {
    private static final TypeReference<List<CartItemDto>> ITEMS_TYPE = new TypeReference<>() {
    };

    private final CartRepository cartRepository;
    private final ObjectMapper objectMapper;

    public CartService(CartRepository cartRepository, ObjectMapper objectMapper) {
        this.cartRepository = cartRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public CartResponse get(UUID userId) {
        return cartRepository.findById(userId)
                .map(cart -> new CartResponse(deserialize(cart.getItems()), cart.getUpdatedAt()))
                .orElseGet(() -> new CartResponse(List.of(), null));
    }

    @Transactional
    public CartResponse replace(UUID userId, List<CartItemDto> items) {
        ensureNoDuplicateProducts(items);

        Cart cart = cartRepository.findById(userId).orElseGet(() -> {
            Cart newCart = new Cart();
            newCart.setUserId(userId);
            return newCart;
        });
        cart.setItems(serialize(items));
        cart.setUpdatedAt(Instant.now());
        Cart saved = cartRepository.save(cart);
        return new CartResponse(items, saved.getUpdatedAt());
    }

    @Transactional
    public void clear(UUID userId) {
        cartRepository.deleteById(userId);
    }

    private void ensureNoDuplicateProducts(List<CartItemDto> items) {
        Set<String> seen = new HashSet<>();
        for (CartItemDto item : items) {
            if (!seen.add(item.productId())) {
                throw new InvalidCartException("items: productId repetido: " + item.productId());
            }
        }
    }

    private String serialize(List<CartItemDto> items) {
        try {
            return objectMapper.writeValueAsString(items);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Falha ao serializar os itens do carrinho", exception);
        }
    }

    private List<CartItemDto> deserialize(String json) {
        try {
            return objectMapper.readValue(json, ITEMS_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Falha ao ler os itens do carrinho", exception);
        }
    }
}
