# Catalog Service

Serviço de catálogo do ShopMesh, construído com Node.js, Express, Mongoose, MongoDB e
KafkaJS. Além do CRUD de produtos, é o dono do **estoque** na Saga de pedidos.

## Executar localmente

Na raiz do repositório, inicie o MongoDB e o Kafka:

```bash
docker compose -f infra/docker-compose.yml up -d mongo kafka
```

Na pasta `services/catalog-service`, copie `.env.example` para `.env`, defina `JWT_SECRET`
com o **mesmo valor** do Auth Service, instale as dependências e inicie o serviço:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

O serviço estará disponível em `http://localhost:3002`. O healthcheck está em `GET /health`
e as métricas Prometheus em `GET /metrics`. Testes: `npm test`.

| Variável | Descrição |
|---|---|
| `MONGO_URI` | Conexão com o MongoDB |
| `KAFKA_BROKERS` | Brokers separados por vírgula (padrão `localhost:9092`) |
| `JWT_SECRET` | Segredo HS256 compartilhado com o Auth Service (obrigatório) |
| `TRACING_ENABLED` / `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Tracing OpenTelemetry (opcional) |

## Saga de estoque

O consumidor do grupo `catalog-service` lê `order.created`, `payment.approved` e
`payment.rejected` (contrato em [`docs/events.md`](../../docs/events.md)):

| Evento recebido | Ação | Publica |
|---|---|---|
| `ORDER_CREATED` | Reserva as unidades de todos os itens | `STOCK_RESERVED` ou `STOCK_REJECTED` |
| `PAYMENT_APPROVED` | **Efetiva**: baixa o estoque físico e remove a reserva | — |
| `PAYMENT_REJECTED` | **Libera**: remove a reserva sem baixar o estoque | — |

- Cada produto guarda `stock` (físico), `reserved` (soma das reservas) e a lista interna de
  reservas por pedido. A API também devolve `availableStock = stock - reserved`.
- Reservar, efetivar e liberar são `updateOne` condicionais em um único documento: atômicos
  e idempotentes (reentregas do mesmo evento não reservam duas vezes).
- Se algum item não puder ser reservado, as reservas parciais do pedido são desfeitas antes
  de publicar `STOCK_REJECTED`.
- O estado da Saga por pedido fica na coleção `stockreservations`
  (`PROCESSING → RESERVED|REJECTED`, `RESERVED → COMMITTED|RELEASED`).
- Mensagens inválidas vão direto para `<tópico>.DLT`; falhas de processamento são tentadas
  3 vezes (1 s de intervalo) antes da DLT. Toda mensagem na DLT recebe `x-rejected-by: catalog-service`.

## Endpoints

### Listar e buscar produtos

```bash
curl "http://localhost:3002/products?page=1&limit=20&category=geral&search=cafe"
```

Os parâmetros `page` e `limit` são opcionais (padrões `1` e `20`; limite máximo `100`). A busca
usa o índice de texto de nome e descrição. Com um token `ADMIN`, `includeInactive=true` inclui
produtos desativados.

### Consultar produto por ID

```bash
curl http://localhost:3002/products/65a000000000000000000001
```

### Criar produto (ADMIN)

```bash
curl -X POST http://localhost:3002/products \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Café especial","description":"Grãos selecionados","price":39.9,"category":"bebidas","stock":12,"imageUrl":"https://example.com/cafe.jpg"}'
```

### Atualizar produto (ADMIN)

Aceita qualquer subconjunto de `name`, `description`, `price`, `category`, `stock`, `imageUrl`
e `active`. O estoque físico não pode ficar abaixo das unidades reservadas (`409`).

```bash
curl -X PATCH http://localhost:3002/products/<id> \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{"stock":50,"active":true}'
```

Sem token, as rotas de escrita retornam `401`; com token de `CUSTOMER`, `403`.
