package com.shopmesh.payments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopmesh.payments.entity.Payment;
import com.shopmesh.payments.entity.PaymentStatus;
import com.shopmesh.payments.repository.PaymentRepository;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Fluxo ponta a ponta com Kafka e PostgreSQL reais (Testcontainers).
 * Pulado automaticamente quando não há Docker disponível.
 */
// @Testcontainers vem primeiro para os containers só serem parados depois de o contexto Spring fechar.
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PaymentFlowIntegrationTest {
    private static final Duration TIMEOUT = Duration.ofSeconds(60);

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    static final KafkaContainer KAFKA = new KafkaContainer("apache/kafka:4.1.1");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.kafka.bootstrap-servers", KAFKA::getBootstrapServers);
        registry.add("jwt.secret", () -> "integration-test-secret-with-at-least-32-chars");
        registry.add("payment.approval-limit", () -> "5000");
    }

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private KafkaProducer<String, String> producer;
    private KafkaConsumer<String, String> consumer;
    private final List<ConsumerRecord<String, String>> received = new ArrayList<>();

    @BeforeEach
    void setUpClients() {
        producer = new KafkaProducer<>(Map.of(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers(),
                ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class,
                ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class
        ));
        consumer = new KafkaConsumer<>(Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers(),
                ConsumerConfig.GROUP_ID_CONFIG, "integration-test-" + UUID.randomUUID(),
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class
        ));
        consumer.subscribe(List.of("payment.approved", "payment.rejected", "payment.refunded"));
    }

    @AfterEach
    void closeClients() {
        producer.close(Duration.ofSeconds(5));
        consumer.close(Duration.ofSeconds(5));
    }

    @Test
    void paymentWithinLimitIsApproved() throws Exception {
        UUID orderId = UUID.randomUUID();

        publishPaymentRequested(orderId, UUID.randomUUID(), "5000.00");

        JsonNode event = awaitEvent("payment.approved", orderId);
        assertEquals("PAYMENT_APPROVED", event.get("eventType").asText());
        assertEquals(orderId.toString(), event.get("orderId").asText());
        assertEquals(0, new BigDecimal("5000.00").compareTo(event.get("amount").decimalValue()));
        assertNotNull(event.get("paymentId"));
        assertEquals(PaymentStatus.APPROVED, paymentRepository.findByOrderId(orderId).orElseThrow().getStatus());
    }

    @Test
    void paymentAboveLimitIsRejected() throws Exception {
        UUID orderId = UUID.randomUUID();

        publishPaymentRequested(orderId, UUID.randomUUID(), "5000.01");

        JsonNode event = awaitEvent("payment.rejected", orderId);
        assertEquals("PAYMENT_REJECTED", event.get("eventType").asText());
        assertEquals(orderId.toString(), event.get("orderId").asText());
        assertEquals(false, event.get("reason").asText().isBlank());
        assertEquals(PaymentStatus.REJECTED, paymentRepository.findByOrderId(orderId).orElseThrow().getStatus());
    }

    @Test
    void approvedPaymentIsRefunded() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        publishPaymentRequested(orderId, userId, "120.50");
        awaitEvent("payment.approved", orderId);

        publishRefundRequested(orderId, userId, "\"Pedido cancelado\"");

        JsonNode event = awaitEvent("payment.refunded", orderId);
        assertEquals("PAYMENT_REFUNDED", event.get("eventType").asText());
        assertEquals(userId.toString(), event.get("userId").asText());
        assertEquals(0, new BigDecimal("120.50").compareTo(event.get("amount").decimalValue()));
        assertEquals("Pedido cancelado", event.get("reason").asText());
        Payment payment = paymentRepository.findByOrderId(orderId).orElseThrow();
        assertEquals(PaymentStatus.REFUNDED, payment.getStatus());
        assertEquals("Pedido cancelado", payment.getRefundReason());
        assertEquals(payment.getId().toString(), event.get("paymentId").asText());
    }

    @Test
    void repeatedRefundRequestRepublishesTheSameEvent() throws Exception {
        UUID orderId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        publishPaymentRequested(orderId, userId, "80.00");
        awaitEvent("payment.approved", orderId);

        publishRefundRequested(orderId, userId, "null");
        JsonNode first = awaitEvent("payment.refunded", orderId);
        publishRefundRequested(orderId, userId, "null");
        JsonNode second = awaitEvent("payment.refunded", orderId, 2);

        assertEquals(first.get("eventId").asText(), second.get("eventId").asText());
        assertEquals(PaymentStatus.REFUNDED, paymentRepository.findByOrderId(orderId).orElseThrow().getStatus());
    }

    private void publishPaymentRequested(UUID orderId, UUID userId, String amount) throws Exception {
        send("payment.requested", orderId, "{\"eventId\":\"" + UUID.randomUUID() + "\","
                + "\"eventType\":\"PAYMENT_REQUESTED\","
                + "\"occurredAt\":\"2026-10-07T03:20:06.021Z\","
                + "\"orderId\":\"" + orderId + "\","
                + "\"userId\":\"" + userId + "\","
                + "\"amount\":" + amount + "}");
    }

    private void publishRefundRequested(UUID orderId, UUID userId, String reasonJson) throws Exception {
        send("payment.refund.requested", orderId, "{\"eventId\":\"" + UUID.randomUUID() + "\","
                + "\"eventType\":\"PAYMENT_REFUND_REQUESTED\","
                + "\"occurredAt\":\"2026-10-07T03:25:00.000Z\","
                + "\"orderId\":\"" + orderId + "\","
                + "\"userId\":\"" + userId + "\","
                + "\"reason\":" + reasonJson + "}");
    }

    private void send(String topic, UUID orderId, String payload) throws Exception {
        producer.send(new ProducerRecord<>(topic, orderId.toString(), payload)).get();
    }

    private JsonNode awaitEvent(String topic, UUID orderId) throws Exception {
        return awaitEvent(topic, orderId, 1);
    }

    /** Aguarda a n-ésima mensagem do tópico com a chave do pedido e devolve seu conteúdo. */
    private JsonNode awaitEvent(String topic, UUID orderId, int occurrence) throws Exception {
        long deadline = System.nanoTime() + TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            consumer.poll(Duration.ofMillis(500)).forEach(received::add);
            List<ConsumerRecord<String, String>> matching = received.stream()
                    .filter(record -> record.topic().equals(topic) && orderId.toString().equals(record.key()))
                    .toList();
            if (matching.size() >= occurrence) {
                return objectMapper.readTree(matching.get(occurrence - 1).value());
            }
        }
        return fail("Nenhuma mensagem em " + topic + " para o pedido " + orderId);
    }
}
