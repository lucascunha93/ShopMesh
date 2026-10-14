package com.shopmesh.orders;

import me.paulschwarz.springdotenv.spring.DotenvApplicationInitializer;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class OrdersServiceApplication {
    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(OrdersServiceApplication.class);
        application.addInitializers(new DotenvApplicationInitializer());
        application.run(args);
    }
}
