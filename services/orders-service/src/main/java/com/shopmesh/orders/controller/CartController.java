package com.shopmesh.orders.controller;

import com.shopmesh.orders.dto.CartResponse;
import com.shopmesh.orders.dto.UpdateCartRequest;
import com.shopmesh.orders.security.AuthContext;
import com.shopmesh.orders.service.CartService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/cart")
public class CartController {
    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public CartResponse get(@RequestAttribute("authContext") AuthContext authContext) {
        return cartService.get(authContext.userId());
    }

    @PutMapping
    public CartResponse replace(@Valid @RequestBody UpdateCartRequest request,
                                @RequestAttribute("authContext") AuthContext authContext) {
        return cartService.replace(authContext.userId(), request.items());
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@RequestAttribute("authContext") AuthContext authContext) {
        cartService.clear(authContext.userId());
    }
}
