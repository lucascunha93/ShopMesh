package com.shopmesh.orders;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopmesh.orders.client.CatalogClient;
import com.shopmesh.orders.client.CatalogProduct;
import com.shopmesh.orders.dto.CreateOrderItemRequest;
import com.shopmesh.orders.dto.CreateOrderRequest;
import com.shopmesh.orders.dto.OrderResponse;
import com.shopmesh.orders.entity.Order;
import com.shopmesh.orders.entity.OrderStatus;
import com.shopmesh.orders.entity.SagaStep;
import com.shopmesh.orders.repository.OrderRepository;
import com.shopmesh.orders.service.OrderService;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

/**
 * Fluxo da Saga orquestrada com Kafka e PostgreSQL reais: o Orders reage aos eventos
 * do Catalog e do Payments (simulados aqui) e publica os comandos seguintes.
 */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class OrderSagaIntegrationTest {
    private static final Duration TIMEOUT = Duration.ofSeconds(60);
    private static final List<String> OBSERVED_TOPICS = List.of(
            "order.created", "order.cancelled", "order.confirmed", "payment.requested",
            "stock.commit", "stock.release", "payment.refund.requested");

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    static final KafkaContainer KAFKA = new KafkaContainer("apache/kafka:4.1.1");

    private static KafkaConsumer<String, String> observer;
    private static final List<ConsumerRecord<String, String>> OBSERVED = new ArrayList<>();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.kafka.bootstrap-servers", KAFKA::getBootstrapServers);
        registry.add("jwt.secret", () -> "segredo-de-teste-com-mais-de-32-caracteres");
    }

    @MockitoBean
    private CatalogClient catalogClient;

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeAll
    static void startObserver() {
        observer = new KafkaConsumer<>(Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers(),
                ConsumerConfig.GROUP_ID_CONFIG, "saga-test-observer-" + UUID.randomUUID(),
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class));
    }

    @AfterAll
    static void stopObserver() {
        if (observer != null) {
            observer.close();
        }
    }

    @Test
    void sagaHappyPathConfirmsOrderAndCommitsStock() throws Exception {
        UUID orderId = createOrder();
        awaitMessage("order.created", orderId);
        assertEquals(SagaStep.STOCK_RESERVATION, orderRepository.findById(orderId).orElseThrow().getSagaStep());

        publish("stock.reserved", stockEvent("STOCK_RESERVED", orderId));
        JsonNode paymentRequested = awaitMessage("payment.requested", orderId);
        assertEquals("PAYMENT_REQUESTED", paymentRequested.get("eventType").asText());
        assertEquals(0, new BigDecimal("200.00").compareTo(paymentRequested.get("amount").decimalValue()));
        assertEquals(SagaStep.PAYMENT, orderRepository.findById(orderId).orElseThrow().getSagaStep());

        publish("payment.approved", paymentEvent("PAYMENT_APPROVED", orderId, null));
        JsonNode commit = awaitMessage("stock.commit", orderId);
        assertEquals("STOCK_COMMIT_REQUESTED", commit.get("eventType").asText());
        JsonNode confirmed = awaitMessage("order.confirmed", orderId);
        assertEquals("ORDER_CONFIRMED", confirmed.get("eventType").asText());
        assertEquals(0, new BigDecimal("200.00").compareTo(confirmed.get("totalAmount").decimalValue()));
        assertEquals(orderRepository.findById(orderId).orElseThrow().getUserId().toString(),
                confirmed.get("userId").asText());
        awaitOrder(orderId, OrderStatus.CONFIRMED);
        assertEquals(SagaStep.DONE, orderRepository.findById(orderId).orElseThrow().getSagaStep());
    }

    @Test
    void paymentRejectedCancelsOrderAndReleasesStock() throws Exception {
        UUID orderId = createOrder();
        awaitMessage("order.created", orderId);
        publish("stock.reserved", stockEvent("STOCK_RESERVED", orderId));
        awaitMessage("payment.requested", orderId);

        publish("payment.rejected", paymentEvent("PAYMENT_REJECTED", orderId, "Saldo insuficiente"));

        JsonNode release = awaitMessage("stock.release", orderId);
        assertEquals("STOCK_RELEASE_REQUESTED", release.get("eventType").asText());
        assertEquals("Saldo insuficiente", release.get("reason").asText());
        Order order = awaitOrder(orderId, OrderStatus.CANCELLED);
        assertEquals("Saldo insuficiente", order.getStatusReason());
    }

    @Test
    void manualCancellationThenLatePaymentApprovalRequestsRefund() throws Exception {
        UUID orderId = createOrder();
        awaitMessage("order.created", orderId);
        publish("stock.reserved", stockEvent("STOCK_RESERVED", orderId));
        awaitMessage("payment.requested", orderId);

        orderService.updateStatus(orderId, OrderStatus.CANCELLED);

        awaitMessage("order.cancelled", orderId);
        awaitMessage("stock.release", orderId);
        awaitOrder(orderId, OrderStatus.CANCELLED);

        publish("payment.approved", paymentEvent("PAYMENT_APPROVED", orderId, null));

        JsonNode refund = awaitMessage("payment.refund.requested", orderId);
        assertEquals("PAYMENT_REFUND_REQUESTED", refund.get("eventType").asText());
        assertEquals("Pedido cancelado antes da confirmação do pagamento", refund.get("reason").asText());
        assertEquals(OrderStatus.CANCELLED, orderRepository.findById(orderId).orElseThrow().getStatus());
    }

    private UUID createOrder() {
        when(catalogClient.getProduct("product-1"))
                .thenReturn(new CatalogProduct("product-1", "Teclado", new BigDecimal("100.00"), 10));
        OrderResponse response = orderService.create(
                new CreateOrderRequest(List.of(new CreateOrderItemRequest("product-1", 2))), UUID.randomUUID());
        return response.id();
    }

    private Order awaitOrder(UUID orderId, OrderStatus status) {
        await().atMost(TIMEOUT).until(
                () -> orderRepository.findById(orderId).map(Order::getStatus).orElse(null) == status);
        return orderRepository.findById(orderId).orElseThrow();
    }

    private void publish(String topic, Map<String, Object> event) throws Exception {
        kafkaTemplate.send(topic, event.get("orderId").toString(), objectMapper.writeValueAsString(event)).get();
    }

    private Map<String, Object> stockEvent(String type, UUID orderId) {
        Map<String, Object> event = baseEvent(type, orderId);
        event.put("userId", UUID.randomUUID());
        event.put("totalAmount", new BigDecimal("200.00"));
        event.put("items", List.of(Map.of("productId", "product-1", "quantity", 2)));
        return event;
    }

    private Map<String, Object> paymentEvent(String type, UUID orderId, String reason) {
        Map<String, Object> event = baseEvent(type, orderId);
        event.put("paymentId", UUID.randomUUID());
        event.put("userId", UUID.randomUUID());
        event.put("amount", new BigDecimal("200.00"));
        if (reason != null) {
            event.put("reason", reason);
        }
        return event;
    }

    private Map<String, Object> baseEvent(String type, UUID orderId) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventId", UUID.randomUUID());
        event.put("eventType", type);
        event.put("occurredAt", Instant.now().toString());
        event.put("orderId", orderId);
        return event;
    }

    // Lê dos tópicos produzidos pelo Orders até achar a mensagem do pedido; a chave Kafka deve ser o orderId.
    private JsonNode awaitMessage(String topic, UUID orderId) {
        if (observer.subscription().isEmpty()) {
            observer.subscribe(OBSERVED_TOPICS);
        }
        JsonNode[] found = new JsonNode[1];
        await().atMost(TIMEOUT).until(() -> {
            observer.poll(Duration.ofMillis(500)).forEach(OBSERVED::add);
            for (ConsumerRecord<String, String> record : OBSERVED) {
                if (record.topic().equals(topic) && orderId.toString().equals(record.key())) {
                    JsonNode json = objectMapper.readTree(record.value());
                    assertEquals(orderId.toString(), json.get("orderId").asText());
                    found[0] = json;
                    return true;
                }
            }
            return false;
        });
        return found[0];
    }
}
