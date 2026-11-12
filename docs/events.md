# Contrato de eventos — Versão 3 (Saga orquestrada)

Este documento é a fonte de verdade para a comunicação assíncrona entre os
serviços. Cada serviço implementa sua própria representação do evento; o
contrato compartilhado é o JSON, não classes Java ou JavaScript compartilhadas.

A Saga é **orquestrada pelo `orders-service`**: ele decide o próximo passo a cada
resposta e envia *comandos* (`payment.requested`, `stock.commit`, `stock.release`,
`payment.refund.requested`) aos participantes. Catalog e Payments não reagem mais
aos eventos um do outro; só respondem ao Orders.

## Tópicos

| Tópico | Tipo | Produtor | Consumidor |
| --- | --- | --- | --- |
| `order.created` | comando (reservar estoque) | `orders-service` | `catalog-service`, `notifications-service` |
| `stock.reserved` | resposta | `catalog-service` | `orders-service` |
| `stock.rejected` | resposta | `catalog-service` | `orders-service`, `notifications-service` |
| `payment.requested` | comando (cobrar) | `orders-service` | `payments-service` |
| `payment.approved` | resposta | `payments-service` | `orders-service` |
| `payment.rejected` | resposta | `payments-service` | `orders-service`, `notifications-service` |
| `stock.commit` | comando (efetivar reserva) | `orders-service` | `catalog-service` |
| `stock.release` | comando (liberar reserva) | `orders-service` | `catalog-service` |
| `payment.refund.requested` | comando (estornar) | `orders-service` | `payments-service` |
| `payment.refunded` | resposta | `payments-service` | `notifications-service` |
| `order.cancelled` | evento informativo | `orders-service` | `notifications-service` |
| `order.confirmed` | evento informativo | `orders-service` | `notifications-service` |
| `<tópico>.DLT` | dead letter | Serviço que rejeita a mensagem | Operação/diagnóstico do serviço responsável |

Mensagens que falharem após as tentativas de processamento configuradas vão para
`<tópico>.DLT` (dead letter topic), por exemplo `stock.reserved.DLT`. Mensagens
inválidas — com JSON malformado ou campos obrigatórios ausentes — não são
retentadas e vão diretamente para a DLT correspondente. A mensagem na DLT deve
conter um cabeçalho que identifique qual serviço rejeitou a mensagem.

Cabeçalhos gravados na mensagem da DLT (a chave e o corpo originais são preservados):

| Cabeçalho | Valor |
| --- | --- |
| `x-rejected-by` | Serviço que rejeitou: `orders-service`, `payments-service`, `catalog-service` ou `notifications-service`. |
| `x-error-type` | `INVALID_EVENT` (JSON malformado ou campo obrigatório ausente, sem novas tentativas) ou `PROCESSING_FAILED` (falhou nas 3 tentativas). |

Os serviços Java também mantêm os cabeçalhos `kafka_dlt-*` do Spring Kafka (tópico,
partição, offset e exceção originais). Os serviços Node acrescentam `x-original-topic`,
`x-original-partition`, `x-original-offset`, `x-attempts` e `x-error-message`.

O `notifications-service` apenas observa a Saga: consome os eventos para avisar o
cliente e não publica nada além das DLTs.

A chave Kafka de toda mensagem é sempre o `orderId`, garantindo que eventos do
mesmo pedido sejam lidos em ordem na mesma partição.

## Regras gerais

- O corpo da mensagem é JSON codificado em UTF-8.
- Datas são strings ISO-8601 em UTC, por exemplo
  `2026-10-07T03:20:06.021Z`; nunca são valores epoch numéricos.
- Valores monetários são números JSON.
- Todo evento contém `eventId` (UUID v4 novo a cada evento), `eventType`,
  `occurredAt` e `orderId`.
- Consumidores ignoram campos desconhecidos para permitir compatibilidade futura.
- Serviços não compartilham classes Java/JavaScript: cada um define sua própria
  cópia do evento.
- A entrega é at-least-once: o mesmo evento pode ser recebido mais de uma vez.
  Todo consumidor deve ser idempotente.
- Eventos com JSON inválido ou campos obrigatórios ausentes são inválidos: não
  são retentados e seguem diretamente para `<tópico>.DLT`, com cabeçalho que
  identifica o serviço que os rejeitou.

## Semântica da Saga (orquestrada)

```text
                         ┌──────────── orders-service (orquestrador) ────────────┐
 POST /orders            │                                                       │
      │  PENDING         │                                                       │
      └─ order.created ──┼──► catalog: reserva estoque                           │
                         │       ├─ stock.reserved ──► Orders ── payment.requested ──► payments: cobra
                         │       └─ stock.rejected ──► Orders cancela                │
                         │                                                       │
                         │   payment.approved ──► Orders confirma ── stock.commit ──► catalog efetiva
                         │   payment.rejected ──► Orders cancela  ── stock.release ─► catalog libera
                         │                                                       │
                         │   cancelamento manual ─ stock.release + order.cancelled
                         │   payment.approved tardio (pedido já cancelado) ──►
                         │        payment.refund.requested ──► payments estorna ──► payment.refunded
                         └───────────────────────────────────────────────────────┘
```

O Orders guarda o passo atual da Saga em cada pedido (`sagaStep`: `STOCK_RESERVATION`,
`PAYMENT`, `DONE`) e só avança o pedido `PENDING`; respostas repetidas ou fora de
ordem são ignoradas ou respondidas com a compensação adequada.

| Passo | Comando | Sucesso | Falha | Compensação |
| --- | --- | --- | --- | --- |
| 1. Reservar estoque (`catalog-service`) | `order.created` | Responde `STOCK_RESERVED`; o Orders passa ao passo 2. | Responde `STOCK_REJECTED`; o Orders cancela o pedido. | Nada a desfazer: nenhuma reserva foi criada. |
| 2. Cobrar (`payments-service`) | `payment.requested` | Responde `PAYMENT_APPROVED`; o Orders confirma o pedido e envia `stock.commit`. | Responde `PAYMENT_REJECTED`; o Orders cancela o pedido e envia `stock.release`. | `stock.release` libera a reserva. |
| 3. Cancelamento manual pelo Admin | — | Orders cancela, envia `stock.release` e publica `order.cancelled`. | — | Se um `PAYMENT_APPROVED` chegar depois, o Orders envia `payment.refund.requested` e `stock.release`. |

Reservar não é descontar estoque: **reservar** segura unidades para o pedido sem
baixar o estoque físico. **Efetivar** baixa o estoque físico de vez e remove a
reserva. **Liberar** remove somente a reserva e não baixa o estoque físico.

O `catalog-service` mantém um estado de Saga por pedido. As transições permitidas
são:

| Estado atual | Próximos estados permitidos |
| --- | --- |
| `PROCESSING` | `RESERVED`, `REJECTED` |
| `RESERVED` | `COMMITTED`, `RELEASED` |
| `REJECTED` | Final; nenhuma transição |
| `COMMITTED` | Final; nenhuma transição |
| `RELEASED` | Final; nenhuma transição |

## `ORDER_CREATED` — tópico `order.created`

Produzido pelo `orders-service` e consumido pelo `catalog-service`, que tenta
reservar o estoque solicitado. O evento mantém o formato da versão 1.

```json
{
  "eventId": "uuid",
  "eventType": "ORDER_CREATED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "userId": "uuid",
  "totalAmount": 699.80,
  "items": [
    {
      "productId": "string",
      "quantity": 2,
      "unitPrice": 349.90
    }
  ]
}
```

## `STOCK_RESERVED` — tópico `stock.reserved`

Produzido pelo `catalog-service` depois de reservar estoque e consumido pelo
`orders-service`, que então envia `payment.requested`. O formato da versão 2 foi
mantido (`userId`, `totalAmount` e `items` repassados do `ORDER_CREATED`).

```json
{
  "eventId": "uuid",
  "eventType": "STOCK_RESERVED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "userId": "uuid",
  "totalAmount": 699.80,
  "items": [
    {
      "productId": "string",
      "quantity": 2
    }
  ]
}
```

## `STOCK_REJECTED` — tópico `stock.rejected`

Produzido pelo `catalog-service` quando não consegue reservar estoque e
consumido pelo `orders-service`, que cancela o pedido.

```json
{
  "eventId": "uuid",
  "eventType": "STOCK_REJECTED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "userId": "uuid",
  "reason": "Estoque insuficiente para Teclado Mecanico (solicitado: 20, disponível: 15)"
}
```

## `PAYMENT_APPROVED` — tópico `payment.approved`

Produzido pelo `payments-service` e consumido pelo `orders-service` (confirma o
pedido e envia `stock.commit`). O `notifications-service` não o consome: o cliente
é avisado por `order.confirmed`, publicado pelo Orders só quando o pedido de fato
é confirmado. O evento mantém o formato da versão 1.

```json
{
  "eventId": "uuid",
  "eventType": "PAYMENT_APPROVED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "paymentId": "uuid",
  "userId": "uuid",
  "amount": 699.80
}
```

## `PAYMENT_REJECTED` — tópico `payment.rejected`

Produzido pelo `payments-service` e consumido pelo `orders-service` (cancela o
pedido e envia `stock.release`) e pelo `notifications-service`. O evento
mantém o formato da versão 1.

```json
{
  "eventId": "uuid",
  "eventType": "PAYMENT_REJECTED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "paymentId": "uuid",
  "userId": "uuid",
  "amount": 6998.00,
  "reason": "texto legível explicando a rejeição"
}
```

## `ORDER_CANCELLED` — tópico `order.cancelled`

Evento informativo produzido pelo `orders-service` somente quando um administrador
cancela manualmente um pedido `PENDING`; consumido pelo `notifications-service`.
A liberação do estoque vai por `stock.release`. `reason` pode ser `null`.

```json
{
  "eventId": "uuid",
  "eventType": "ORDER_CANCELLED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "userId": "uuid",
  "reason": null
}
```

## `ORDER_CONFIRMED` — tópico `order.confirmed`

Evento informativo produzido pelo `orders-service` sempre que um pedido passa a
`CONFIRMED` (por `payment.approved` ou por confirmação manual no Admin);
consumido pelo `notifications-service`.

```json
{
  "eventId": "uuid",
  "eventType": "ORDER_CONFIRMED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "userId": "uuid",
  "totalAmount": 699.80
}
```

## `PAYMENT_REQUESTED` — tópico `payment.requested`

Comando do `orders-service` para o `payments-service` cobrar o pedido, enviado ao
receber `STOCK_RESERVED`. O Payments é idempotente por `orderId`.

```json
{
  "eventId": "uuid",
  "eventType": "PAYMENT_REQUESTED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "userId": "uuid",
  "amount": 699.80
}
```

## `STOCK_COMMIT_REQUESTED` — tópico `stock.commit`

Comando do `orders-service` para o `catalog-service` efetivar a reserva
(`RESERVED` → `COMMITTED`), enviado quando o pedido é confirmado.

```json
{
  "eventId": "uuid",
  "eventType": "STOCK_COMMIT_REQUESTED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "userId": "uuid"
}
```

## `STOCK_RELEASE_REQUESTED` — tópico `stock.release`

Comando do `orders-service` para o `catalog-service` liberar a reserva
(`RESERVED` → `RELEASED`), enviado quando o pedido é cancelado (pagamento
recusado, cancelamento manual ou `payment.approved` tardio). Se a reserva ainda
não existir, o Orders reenvia o comando ao receber `STOCK_RESERVED` de um pedido
já cancelado.

```json
{
  "eventId": "uuid",
  "eventType": "STOCK_RELEASE_REQUESTED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "userId": "uuid",
  "reason": "texto opcional ou null"
}
```

## `PAYMENT_REFUND_REQUESTED` — tópico `payment.refund.requested`

Comando do `orders-service` para o `payments-service` estornar uma cobrança
aprovada de um pedido que já estava cancelado. O Payments só estorna pagamentos
`APPROVED`; os demais casos são ignorados.

```json
{
  "eventId": "uuid",
  "eventType": "PAYMENT_REFUND_REQUESTED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "userId": "uuid",
  "reason": "Pedido cancelado antes da confirmação do pagamento"
}
```

## `PAYMENT_REFUNDED` — tópico `payment.refunded`

Resposta do `payments-service` depois de estornar; consumido pelo
`notifications-service`.

```json
{
  "eventId": "uuid",
  "eventType": "PAYMENT_REFUNDED",
  "occurredAt": "2026-10-07T03:20:06.021Z",
  "orderId": "uuid",
  "paymentId": "uuid",
  "userId": "uuid",
  "amount": 699.80,
  "reason": "texto opcional ou null"
}
```

## Histórico de versões

- **v1 — Fase 7:** contrato com `order.created`, `payment.approved` e
  `payment.rejected`.
- **v2 — Fase 8:** adiciona `stock.reserved` e `stock.rejected` para a Saga de
  estoque e muda os consumidores: Catalog consome `order.created`; Payments
  deixa de consumi-lo e passa a consumir `stock.reserved`; Orders e Catalog
  consomem `payment.approved` e `payment.rejected`.
- **v2.1 — Fase 9:** sem mudança de formato. O `notifications-service` passa a
  consumir `order.created`, `stock.rejected`, `payment.approved` e
  `payment.rejected`; os cabeçalhos das DLTs foram documentados.
- **v2.2:** adiciona `order.cancelled` (cancelamento manual de pedido `PENDING`
  pelo Admin), consumido por Notifications.
- **v3 — Saga orquestrada:** o `orders-service` vira orquestrador. Novos
  comandos `payment.requested`, `stock.commit`, `stock.release` e
  `payment.refund.requested`, e nova resposta `payment.refunded`. Payments deixa
  de consumir `stock.reserved` (consumido só pelo Orders) e Catalog deixa de
  consumir `payment.*`. O `order.confirmed` (novo) substitui `payment.approved`
  como gatilho da notificação de confirmação.
