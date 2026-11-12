# Payments Service

Serviço de pagamentos do ShopMesh, implementado com Spring Boot 3, Java 21,
Spring Data JPA, PostgreSQL e Kafka.

## Configuração e execução

O PostgreSQL local deve estar disponível em `localhost:5432`, com o banco
`payments_db` e usuário/senha `shopmesh`. O Kafka local deve estar disponível
em `localhost:9092`.

O `spring-dotenv` carrega automaticamente o `.env` desta pasta. Copie
`.env.example` para `.env` e configure `JWT_SECRET` com o mesmo segredo usado
pelo Auth Service e pelo Orders Service. Variáveis do ambiente real têm
precedência sobre valores do `.env`. O segredo precisa ter pelo menos 32
caracteres; caso contrário, a aplicação falha no arranque com uma mensagem
clara.

Na raiz do repositório, inicie a infraestrutura:

```powershell
docker compose -f infra/docker-compose.yml up -d postgres kafka
```

Na pasta `services/payments-service`, execute:

```powershell
Copy-Item .env.example .env
.\mvnw spring-boot:run
```

Por padrão, a API escuta em `http://localhost:8083`. O Hibernate gerencia o
schema com `ddl-auto: update`, como no Orders Service.

## Fluxo de pagamento e idempotência

O consumidor do grupo `payments-service` lê mensagens `payment.requested` desde o
início do tópico: a cobrança é solicitada pelo Orders Service, que orquestra a Saga
(`amount` é o valor a cobrar). Campos desconhecidos no JSON são ignorados. O
`PaymentProcessor` decide e grava a cobrança em uma transação: valores até
`PAYMENT_APPROVAL_LIMIT` (inclusive) são aprovados; valores acima são
rejeitados com um motivo legível.

Cada pedido tem no máximo um pagamento, protegido por uma restrição `UNIQUE`
em `order_id`. Se o mesmo evento for entregue novamente, o serviço reutiliza o
pagamento já gravado e publica novamente o resultado. Assim, uma falha ao
publicar o resultado não cria outra cobrança. A publicação síncrona espera até
10 segundos e sua falha aciona novas tentativas Kafka.

Depois de três tentativas, mensagens de `payment.requested` e `payment.refund.requested` que ainda falharem são
enviadas para `payment.requested.DLT` e `payment.refund.requested.DLT` (Dead Letter Topic), para inspeção e
reprocessamento operacional. Mensagens com JSON malformado ou sem campos obrigatórios
não são retentadas e vão direto para a DLT. Toda mensagem na DLT recebe os cabeçalhos
`x-rejected-by: payments-service` e `x-error-type`. Os tópicos `payment.approved`,
`payment.rejected` e `payment.refunded` têm três partições cada; seus tópicos DLT também são
declarados.

### Estorno

O evento `payment.refund.requested` (enviado pelo Orders Service) estorna o pagamento
`APPROVED` do pedido: o status passa a `REFUNDED`, o motivo é guardado em `refundReason` e
`payment.refunded` é publicado. Um pedido já estornado apenas republica o mesmo evento
(idempotente). Pedido sem pagamento ou com pagamento rejeitado é ignorado (apenas log).

O contrato JSON dos eventos está em [`../../docs/events.md`](../../docs/events.md).

## Endpoints

### Health (sem autenticação)

```powershell
curl.exe http://localhost:8083/health
```

Resposta: `{"status":"ok","service":"payments-service"}`.

### Consultar pagamento por pedido

Todas as chamadas `/payments` exigem um token JWT Bearer emitido pelo Auth
Service. O cliente só pode consultar pagamentos próprios; usuários `ADMIN`
podem consultar qualquer pagamento.

```powershell
curl.exe http://localhost:8083/payments/order/<order-id> `
  -H "Authorization: Bearer <token>"
```

Não existe endpoint para criar pagamentos: eles são criados somente pelo
consumo de eventos `payment.requested`. Pedidos sem pagamento solicitado
(a consulta retorna `404`) ainda não foram cobrados.

## Observabilidade

- Métricas Prometheus em `GET /actuator/prometheus` e saúde em `GET /actuator/health`
  (o gateway não expõe `/actuator`).
- Tracing OpenTelemetry desligado por padrão. Com `TRACING_ENABLED=true`, os spans vão para
  `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` (padrão `http://localhost:4318/v1/traces`, o Jaeger do
  profile `observability`). O contexto é propagado pelos cabeçalhos das mensagens Kafka.

