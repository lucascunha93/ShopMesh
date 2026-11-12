# Orders Service

Serviço de pedidos do ShopMesh, implementado com Spring Boot 3, Java 21, Spring Data JPA e PostgreSQL.

## Configuração

O PostgreSQL local deve estar disponível em `localhost:5432`, com o banco `orders_db` e usuário/senha `shopmesh`. O serviço lê `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`, `JWT_SECRET`, `CATALOG_SERVICE_URL` e `PORT`; os valores locais estão em `.env.example`.

O `spring-dotenv` carrega automaticamente o arquivo `.env` da pasta do serviço ao iniciar a aplicação. Copie `.env.example` para `.env` e ajuste `JWT_SECRET` para o **mesmo valor exato** de `JWT_SECRET` usado pelo Auth Service. Os dois serviços precisam compartilhar o segredo para que os tokens HS256 emitidos pelo Auth sejam aceitos aqui. Uma variável definida no ambiente real do sistema tem precedência sobre a mesma variável no `.env`, conforme observado ao iniciar o serviço com um `PORT` de sistema diferente do configurado no arquivo.

No arranque, o serviço exige que `JWT_SECRET` tenha pelo menos 32 caracteres (256 bits); se não tiver, encerra com uma mensagem explícita em português.

O Orders Service é o **orquestrador da Saga**. Ele publica `ORDER_CREATED` em `order.created` somente após o commit do pedido (passo `sagaStep` = `STOCK_RESERVATION`) e reage aos eventos: `STOCK_RESERVED` (`stock.reserved`) avança para o passo `PAYMENT` e publica o comando `PAYMENT_REQUESTED` (`payment.requested`, com `userId` e `amount`); `PAYMENT_APPROVED` confirma o pedido e publica `STOCK_COMMIT_REQUESTED` (`stock.commit`) e o evento informativo `ORDER_CONFIRMED` (`order.confirmed`, também publicado na confirmação manual pelo Admin; consumido pelo notifications-service); `PAYMENT_REJECTED` e `STOCK_REJECTED` cancelam o pedido (o primeiro também publica `STOCK_RELEASE_REQUESTED` em `stock.release`). Se um pedido cancelado manualmente receber `PAYMENT_APPROVED` tardio, o Orders publica `PAYMENT_REFUND_REQUESTED` (`payment.refund.requested`) e `stock.release`. Todos os comandos saem após o commit da transação, com `orderId` como chave. Cancelamentos registram o motivo em `statusReason`. Mensagens repetidas, pedidos já processados e IDs inexistentes são ignorados; falhas de processamento passam por três tentativas com intervalo de um segundo e depois são encaminhadas para o tópico correspondente `.DLT`. Mensagens com JSON malformado ou sem campos obrigatórios vão direto para a DLT, sem novas tentativas, com o cabeçalho `x-rejected-by: orders-service`. Configure `KAFKA_BOOTSTRAP_SERVERS` para apontar ao broker; o padrão local é `localhost:9092`. O producer usa `orderId` como chave, habilita idempotência e aguarda confirmação de todas as réplicas (`acks=all`); o consumer usa o grupo `orders-service` e começa em `earliest`. O contrato dos eventos está em [`docs/events.md`](../../docs/events.md).

O script `infra/postgres-init/init-databases.sql` cria `orders_db` somente na primeira inicialização do volume de dados do Postgres. Se o volume já tiver sido inicializado antes da criação do banco, crie o banco manualmente ou recrie o volume conforme as instruções da raiz do projeto; essa recriação apaga também os dados locais de `auth_db`.

## Executar localmente

Inicie o Postgres na raiz do repositório e, dentro de `services/orders-service`, execute no PowerShell:

```powershell
.\mvnw spring-boot:run
```

O serviço escuta por padrão em `http://localhost:8081`. O `CATALOG_SERVICE_URL` padrão é `http://localhost:3002`.

## Token JWT para testes

Registre um usuário ou faça login pelo Auth Service e copie o campo `token` da resposta. O Auth assina o token com HS256, incluindo `sub` com o UUID do usuário e `role` (`CUSTOMER` ou `ADMIN`). Use o endpoint `POST /login` do Auth Service, por exemplo:

```powershell
curl.exe -X POST http://localhost:3001/login `
  -H "Content-Type: application/json" `
  -d '{"email":"ana@example.com","password":"senha-segura"}'
```

O `JWT_SECRET` do processo do Orders Service precisa ser exatamente igual ao configurado no Auth Service. Defina o token obtido nas instruções abaixo no lugar de `<token>`.

Para testar operações administrativas, registre um usuário e altere seu role no banco do Auth Service para `ADMIN`, por exemplo:

```powershell
docker exec shopmesh-postgres psql -U shopmesh -d auth_db -c "UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';"
```

## Endpoints

### Health (sem autenticação)

```powershell
curl.exe http://localhost:8081/health
```

Resposta: `{"status":"ok","service":"orders-service"}`.

### Criar pedido

Cada `productId` deve ser o ID string do produto no Catalog Service. O preço e o nome são copiados do catálogo no momento da compra.

```powershell
curl.exe -X POST http://localhost:8081/orders `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d '{"items":[{"productId":"<id-do-produto>","quantity":2}]}'
```

Um ID inexistente retorna `404` com o `productId` na mensagem e nenhum pedido é salvo:

```powershell
curl.exe -X POST http://localhost:8081/orders `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d '{"items":[{"productId":"produto-inexistente","quantity":1}]}'
```

Se o Catalog Service estiver indisponível, a resposta é `503`.

### Listar os próprios pedidos

O resultado é filtrado pelo `sub` do token. `page` começa em zero e `size` usa 20 por padrão.

```powershell
curl.exe "http://localhost:8081/orders?page=0&size=20" `
  -H "Authorization: Bearer <token>"
```

### Consultar um pedido

Um cliente pode consultar somente os próprios pedidos. Para demonstrar o `403`, autentique-se com o token de outro usuário e use um ID de pedido pertencente à primeira conta:

```powershell
curl.exe http://localhost:8081/orders/<id-do-pedido-de-outro-usuario> `
  -H "Authorization: Bearer <token-de-outro-usuario>"
```

Um usuário com role `ADMIN` pode consultar pedidos de outros usuários.

### Listar todos os pedidos (ADMIN)

Ordenados do mais recente para o mais antigo; `status` é opcional (`PENDING`, `CONFIRMED` ou `CANCELLED`). Um `CUSTOMER` recebe `403`.

```powershell
curl.exe "http://localhost:8081/orders/all?status=PENDING&page=0&size=20" `
  -H "Authorization: Bearer <token-admin>"
```

### Atualizar o status (ADMIN)

Somente `ADMIN` pode confirmar ou cancelar um pedido ainda `PENDING`.

```powershell
curl.exe -X PATCH http://localhost:8081/orders/<id-do-pedido>/status `
  -H "Authorization: Bearer <token-admin>" `
  -H "Content-Type: application/json" `
  -d '{"status":"CONFIRMED"}'
```

Também é possível enviar `"status":"CANCELLED"`. Tentar alterar novamente um pedido confirmado ou cancelado retorna `400`.

> A mudança manual participa da Saga: o cancelamento publica `order.cancelled` e `stock.release`; a confirmação, se o pagamento já estiver em andamento (passo `PAYMENT`), publica `stock.commit`. Se o pagamento for aprovado depois do cancelamento, o estorno é solicitado automaticamente.

### Carrinho (JWT obrigatório; sempre do usuário do token)

```powershell
curl.exe http://localhost:8081/cart -H "Authorization: ******"
curl.exe -X PUT http://localhost:8081/cart `
  -H "Authorization: ******" `
  -H "Content-Type: application/json" `
  -d '{"items":[{"productId":"<id>","name":"Teclado","price":199.9,"category":"perifericos","imageUrl":"http://exemplo/img.png","quantity":2}]}'
curl.exe -X DELETE http://localhost:8081/cart -H "Authorization: ******"
```

`GET /cart` retorna `{"items":[...],"updatedAt":...}` (vazio se não existir); `PUT /cart` substitui o carrinho inteiro (máx. 100 itens, `productId`/`name`/`category` não vazios, `price >= 0`, `quantity` de 1 a 999, sem `productId` repetido; caso contrário `400`); `DELETE /cart` responde `204`. Criar um pedido não limpa o carrinho: o frontend faz isso.

## Testes

`.\mvnw.cmd --batch-mode test` roda os testes unitários e o `OrderSagaIntegrationTest`, que usa Testcontainers (Kafka e PostgreSQL reais) e é ignorado se não houver Docker. O pom sobrescreve `testcontainers.version` para 1.21.4 por compatibilidade com o Docker Engine 29.

### Observabilidade

- Métricas Prometheus em `GET /actuator/prometheus` e saúde em `GET /actuator/health`
  (o gateway não expõe `/actuator`).
- Tracing OpenTelemetry desligado por padrão. Com `TRACING_ENABLED=true`, os spans vão para
  `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` (padrão `http://localhost:4318/v1/traces`, o Jaeger do
  profile `observability`). O contexto é propagado pelos cabeçalhos das mensagens Kafka.

### Token ausente

Qualquer rota `/orders` exige um Bearer token. Sem token, o resultado é `401`:

```powershell
curl.exe http://localhost:8081/orders
```
