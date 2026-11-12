package com.shopmesh.payments.config;

import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * O {@code ddl-auto=update} do Hibernate não altera a constraint de CHECK criada
 * para o enum {@code status} em tabelas já existentes, o que impediria gravar o
 * novo valor {@code REFUNDED}. Remove a constraint antiga (a validação do valor
 * fica a cargo do enum da entidade). Roda antes de os listeners Kafka iniciarem.
 */
@Component
public class PaymentStatusConstraintMigration implements SmartInitializingSingleton {
    private final JdbcTemplate jdbcTemplate;

    public PaymentStatusConstraintMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void afterSingletonsInstantiated() {
        jdbcTemplate.execute("ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check");
    }
}
