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
    public NewTopic paymentApprovedTopic() {
        return topic("payment.approved");
    }

    @Bean
    public NewTopic paymentRejectedTopic() {
        return topic("payment.rejected");
    }

    @Bean
    public NewTopic paymentApprovedDeadLetterTopic() {
        return topic("payment.approved.DLT");
    }

    @Bean
    public NewTopic paymentRejectedDeadLetterTopic() {
        return topic("payment.rejected.DLT");
    }

    private NewTopic topic(String name) {
        return TopicBuilder.name(name)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
