package com.shopmesh.payments.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.apache.kafka.common.header.internals.RecordHeaders;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

import java.nio.charset.StandardCharsets;

@Configuration
public class PaymentKafkaErrorHandlerConfiguration {
    public static final String SERVICE_NAME = "payments-service";
    public static final String REJECTED_BY_HEADER = "x-rejected-by";
    public static final String ERROR_TYPE_HEADER = "x-error-type";

    @Bean
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, String> kafkaTemplate) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                kafkaTemplate,
                (record, exception) -> new TopicPartition(record.topic() + ".DLT", record.partition())
        );
        recoverer.setHeadersFunction((record, exception) -> {
            String errorType = isInvalidEvent(exception) ? "INVALID_EVENT" : "PROCESSING_FAILED";
            return new RecordHeaders(new RecordHeader[]{
                    new RecordHeader(REJECTED_BY_HEADER, SERVICE_NAME.getBytes(StandardCharsets.UTF_8)),
                    new RecordHeader(ERROR_TYPE_HEADER, errorType.getBytes(StandardCharsets.UTF_8))
            });
        });

        // Três tentativas no total, com um segundo de intervalo. Eventos
        // inválidos (JSON malformado ou campos ausentes) vão direto para a DLT.
        DefaultErrorHandler errorHandler = new DefaultErrorHandler(recoverer, new FixedBackOff(1_000L, 2L));
        errorHandler.addNotRetryableExceptions(JsonProcessingException.class, InvalidEventException.class);
        return errorHandler;
    }

    private static boolean isInvalidEvent(Throwable exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof JsonProcessingException || current instanceof InvalidEventException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
