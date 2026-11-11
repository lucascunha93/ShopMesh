package com.shopmesh.orders.event;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class OrderKafkaConfiguration {
    @Bean
    public NewTopic orderCreatedTopic() {
        return topic(OrderCreatedEventPublisher.ORDER_CREATED_TOPIC);
    }

    @Bean
    public NewTopic orderCancelledTopic() {
        return topic(OrderCancelledEventPublisher.ORDER_CANCELLED_TOPIC);
    }

    @Bean
    public NewTopic stockRejectedTopic() {
        return topic(StockEventListener.STOCK_REJECTED_TOPIC);
    }

    @Bean
    public NewTopic paymentApprovedTopic() {
        return topic(PaymentEventListener.PAYMENT_APPROVED_TOPIC);
    }

    @Bean
    public NewTopic paymentRejectedTopic() {
        return topic(PaymentEventListener.PAYMENT_REJECTED_TOPIC);
    }

    @Bean
    public NewTopic stockRejectedDeadLetterTopic() {
        return topic(StockEventListener.STOCK_REJECTED_TOPIC + ".DLT");
    }

    @Bean
    public NewTopic paymentApprovedDeadLetterTopic() {
        return topic(PaymentEventListener.PAYMENT_APPROVED_TOPIC + ".DLT");
    }

    @Bean
    public NewTopic paymentRejectedDeadLetterTopic() {
        return topic(PaymentEventListener.PAYMENT_REJECTED_TOPIC + ".DLT");
    }

    private NewTopic topic(String name) {
        return TopicBuilder.name(name)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
