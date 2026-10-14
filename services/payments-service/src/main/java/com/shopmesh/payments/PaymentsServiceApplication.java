package com.shopmesh.payments;

import me.paulschwarz.springdotenv.spring.DotenvApplicationInitializer;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class PaymentsServiceApplication {
    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(PaymentsServiceApplication.class);
        application.addInitializers(new DotenvApplicationInitializer());
        application.run(args);
    }
}
