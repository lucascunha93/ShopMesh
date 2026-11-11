# Notifications Service

Serviço de notificações do ShopMesh, em Node.js, Express e KafkaJS. Não tem banco: observa
os eventos da Saga, "envia" a notificação (log estruturado; o canal real seria plugado
em `notificationHandlers.js`) e mantém um feed em memória consultável pela API.

## Executar localmente

```powershell
docker compose -f infra/docker-compose.yml up -d kafka
cd services/notifications-service
Copy-Item .env.example .env   # JWT_SECRET igual ao do Auth Service
npm install
npm run dev
```

O serviço escuta em `http://localhost:3003` (`GET /health`, `GET /metrics`). Testes: `npm test`.

| Variável | Descrição |
|---|---|
| `KAFKA_BROKERS` | Brokers separados por vírgula (padrão `localhost:9092`) |
| `JWT_SECRET` | Segredo HS256 compartilhado com o Auth Service (obrigatório) |
| `NOTIFICATIONS_MAX` | Tamanho máximo do feed em memória (padrão `500`) |

## Eventos consumidos

Grupo `notifications-service`, a partir das mensagens novas (sem histórico a reconstruir):

| Evento | Notificação |
|---|---|
| `ORDER_CREATED` | Pedido recebido |
| `STOCK_REJECTED` | Pedido cancelado (com o motivo do estoque) |
| `PAYMENT_APPROVED` | Pedido confirmado |
| `PAYMENT_REJECTED` | Pagamento recusado (com o motivo) |

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
