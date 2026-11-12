package com.shopmesh.orders.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "carts")
@Getter
@Setter
@NoArgsConstructor
public class Cart {
    @Id
    private UUID userId;

    // Lista de itens serializada em JSON com Jackson.
    @Column(nullable = false, columnDefinition = "TEXT")
    private String items;

    @Column(nullable = false)
    private Instant updatedAt;
}
