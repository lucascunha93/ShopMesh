package com.shopmesh.orders.controller;

import com.shopmesh.orders.dto.CreateOrderRequest;
import com.shopmesh.orders.dto.OrderResponse;
import com.shopmesh.orders.dto.UpdateOrderStatusRequest;
import com.shopmesh.orders.exception.AccessDeniedException;
import com.shopmesh.orders.security.AuthContext;
import com.shopmesh.orders.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/orders")
public class OrderController {
    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse create(@Valid @RequestBody CreateOrderRequest request,
                                @RequestAttribute("authContext") AuthContext authContext) {
        return orderService.create(request, authContext.userId());
    }

    @GetMapping
    public Page<OrderResponse> list(@RequestAttribute("authContext") AuthContext authContext,
                                    @PageableDefault(size = 20) Pageable pageable) {
        return orderService.listForUser(authContext.userId(), pageable);
    }

    @GetMapping("/{id}")
    public OrderResponse getById(@PathVariable UUID id,
                                 @RequestAttribute("authContext") AuthContext authContext) {
        return orderService.getById(id, authContext);
    }

    @PatchMapping("/{id}/status")
    public OrderResponse updateStatus(@PathVariable UUID id,
                                      @Valid @RequestBody UpdateOrderStatusRequest request,
                                      @RequestAttribute("authContext") AuthContext authContext) {
        if (!"ADMIN".equals(authContext.role())) {
            throw new AccessDeniedException();
        }
        return orderService.updateStatus(id, request.status());
    }
}
