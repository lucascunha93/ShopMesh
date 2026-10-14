package com.shopmesh.orders.event;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class OrderKafkaConfiguration {
    @Bean
    public NewTopic orderCreatedTopic() {
        return TopicBuilder.name(OrderCreatedEventPublisher.ORDER_CREATED_TOPIC)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
