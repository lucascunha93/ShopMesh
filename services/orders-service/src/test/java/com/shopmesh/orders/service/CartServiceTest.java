package com.shopmesh.orders.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopmesh.orders.dto.CartItemDto;
import com.shopmesh.orders.dto.CartResponse;
import com.shopmesh.orders.dto.UpdateCartRequest;
import com.shopmesh.orders.entity.Cart;
import com.shopmesh.orders.exception.InvalidCartException;
import com.shopmesh.orders.repository.CartRepository;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UUID userId = UUID.randomUUID();

    @Mock
    private CartRepository cartRepository;

    private CartService cartService() {
        return new CartService(cartRepository, objectMapper);
    }

    @Test
    void getReturnsEmptyCartWhenNoneExists() {
        when(cartRepository.findById(userId)).thenReturn(Optional.empty());

        CartResponse response = cartService().get(userId);

        assertTrue(response.items().isEmpty());
        assertNull(response.updatedAt());
    }

    @Test
    void replaceCreatesCartAndSerializesItems() throws Exception {
        when(cartRepository.findById(userId)).thenReturn(Optional.empty());
        when(cartRepository.save(any(Cart.class))).thenAnswer(invocation -> invocation.getArgument(0));
        List<CartItemDto> items = List.of(item("p1", 2), item("p2", 1));

        CartResponse response = cartService().replace(userId, items);

        ArgumentCaptor<Cart> captor = ArgumentCaptor.forClass(Cart.class);
        verify(cartRepository).save(captor.capture());
        Cart saved = captor.getValue();
        assertEquals(userId, saved.getUserId());
        assertEquals(2, objectMapper.readTree(saved.getItems()).size());
        assertEquals(items, response.items());
        assertEquals(saved.getUpdatedAt(), response.updatedAt());
    }

    @Test
    void replaceOverwritesExistingCart() {
        Cart existing = new Cart();
        existing.setUserId(userId);
        existing.setItems("[]");
        existing.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        when(cartRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(cartRepository.save(existing)).thenReturn(existing);

        CartResponse response = cartService().replace(userId, List.of(item("p1", 3)));

        assertEquals(1, cartService().get(userId).items().size());
        assertEquals(3, response.items().get(0).quantity());
        assertTrue(existing.getUpdatedAt().isAfter(Instant.parse("2026-01-01T00:00:00Z")));
    }

    @Test
    void replaceWithEmptyListStoresEmptyCart() {
        when(cartRepository.findById(userId)).thenReturn(Optional.empty());
        when(cartRepository.save(any(Cart.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CartResponse response = cartService().replace(userId, List.of());

        assertTrue(response.items().isEmpty());
    }

    @Test
    void replaceRejectsDuplicatedProductIds() {
        assertThrows(InvalidCartException.class,
                () -> cartService().replace(userId, List.of(item("p1", 1), item("p1", 2))));

        verify(cartRepository, never()).save(any(Cart.class));
    }

    @Test
    void getDeserializesStoredItems() throws Exception {
        Cart stored = new Cart();
        stored.setUserId(userId);
        stored.setItems(objectMapper.writeValueAsString(List.of(item("p1", 2))));
        stored.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        when(cartRepository.findById(userId)).thenReturn(Optional.of(stored));

        CartResponse response = cartService().get(userId);

        assertEquals(List.of(item("p1", 2)), response.items());
        assertEquals(stored.getUpdatedAt(), response.updatedAt());
    }

    @Test
    void clearDeletesUserCart() {
        cartService().clear(userId);

        verify(cartRepository).deleteById(userId);
    }

    @Test
    void requestValidationEnforcesLimits() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

        assertTrue(validator.validate(new UpdateCartRequest(List.of(item("p1", 1)))).isEmpty());
        assertTrue(validator.validate(new UpdateCartRequest(List.of())).isEmpty());
        assertTrue(validator.validate(new UpdateCartRequest(null)).size() > 0);
        assertTrue(validator.validate(new UpdateCartRequest(List.of(item("p1", 0)))).size() > 0);
        assertTrue(validator.validate(new UpdateCartRequest(List.of(item("p1", 1000)))).size() > 0);
        assertTrue(validator.validate(new UpdateCartRequest(List.of(item(" ", 1)))).size() > 0);
        assertTrue(validator.validate(new UpdateCartRequest(List.of(
                new CartItemDto("p1", "Nome", new BigDecimal("-1"), "cat", null, 1)))).size() > 0);
        assertTrue(validator.validate(new UpdateCartRequest(List.of(
                new CartItemDto("p1", "", BigDecimal.ONE, "cat", null, 1)))).size() > 0);
        assertTrue(validator.validate(new UpdateCartRequest(List.of(
                new CartItemDto("p1", "Nome", BigDecimal.ONE, "", null, 1)))).size() > 0);

        List<CartItemDto> tooMany = new ArrayList<>();
        for (int i = 0; i < 101; i++) {
            tooMany.add(item("p" + i, 1));
        }
        assertTrue(validator.validate(new UpdateCartRequest(tooMany)).size() > 0);
        assertTrue(validator.validate(new UpdateCartRequest(tooMany.subList(0, 100))).isEmpty());
    }

    private CartItemDto item(String productId, int quantity) {
        return new CartItemDto(productId, "Produto " + productId, new BigDecimal("10.50"),
                "eletronicos", "http://img/" + productId, quantity);
    }
}
