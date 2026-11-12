# Notifications Service

Serviço de notificações do ShopMesh, em Node.js, Express, KafkaJS e MongoDB (Mongoose). Observa
os eventos da Saga, "envia" a notificação (log estruturado; o canal real seria plugado
em `notificationHandlers.js`) e persiste o feed no MongoDB, consultável pela API.

## Executar localmente

```powershell
docker compose -f infra/docker-compose.yml up -d kafka mongo
cd services/notifications-service
Copy-Item .env.example .env   # JWT_SECRET igual ao do Auth Service
npm install
npm run dev
```

O serviço escuta em `http://localhost:3003` (`GET /health` informa o tipo de store, `memory` ou
`mongo`; `GET /metrics`). Testes: `npm test` (não exigem MongoDB).

| Variável | Descrição |
|---|---|
| `KAFKA_BROKERS` | Brokers separados por vírgula (padrão `localhost:9092`) |
| `JWT_SECRET` | Segredo HS256 compartilhado com o Auth Service (obrigatório) |
| `MONGO_URI` | Conexão com o MongoDB (mesmo nome do catalog-service), ex.: `mongodb://shopmesh:shopmesh@localhost:27017/shopmesh_notifications?authSource=admin`. Sem ela, o feed fica em memória (aviso no log) |
| `NOTIFICATIONS_MAX` | Tamanho máximo do feed em memória, só sem `MONGO_URI` (padrão `500`) |

## Persistência

Com `MONGO_URI`, as notificações ficam na coleção `notifications`, com índice único em
`eventId` (deduplicação), índice `userId` + `createdAt` (feed do usuário, mais recentes primeiro)
e TTL de 30 dias em `createdAt`.

## Eventos consumidos

Grupo `notifications-service`, a partir das mensagens novas:

| Evento | Notificação |
|---|---|
| `ORDER_CREATED` | Pedido recebido |
| `ORDER_CANCELLED` | Pedido cancelado (com o motivo, se houver) |
| `STOCK_REJECTED` | Pedido cancelado (com o motivo do estoque) |
| `ORDER_CONFIRMED` | Pedido confirmado (com o valor total) |
| `PAYMENT_REJECTED` | Pagamento recusado (com o motivo) |
| `PAYMENT_REFUNDED` | Pagamento estornado (valor e pedido) |

Notificações são deduplicadas por `eventId` (entrega at-least-once). Mensagens inválidas e
falhas após 3 tentativas seguem para `<tópico>.DLT` com `x-rejected-by: notifications-service`.

## Endpoints

```bash
# Notificações do usuário autenticado
curl "http://localhost:3003/notifications/me?limit=20" -H "Authorization: Bearer <token>"

# Todas as notificações (ADMIN)
curl "http://localhost:3003/notifications?limit=50" -H "Authorization: Bearer <token-admin>"
```

Pelo gateway: `/api/notifications/notifications/me`.
