# Contrato de eventos

Este documento é a fonte de verdade para a comunicação assíncrona entre os
serviços. Cada serviço implementa sua própria representação do evento; o
contrato compartilhado é o JSON, não classes Java ou JavaScript compartilhadas.

## Tópicos

| Tópico | Produtor | Consumidor |
| --- | --- | --- |
| `order.created` | `orders-service` | `payments-service` |
| `payment.approved` | `payments-service` | `orders-service` |
| `payment.rejected` | `payments-service` | `orders-service` |

Mensagens que falharem após as tentativas de processamento configuradas vão para
`<tópico>.DLT` (dead letter topic), por exemplo `order.created.DLT`.

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

## `ORDER_CREATED` — tópico `order.created`

Produzido pelo `orders-service` e consumido pelo `payments-service`.

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

## `PAYMENT_APPROVED` — tópico `payment.approved`

Produzido pelo `payments-service` e consumido pelo `orders-service`.

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

Produzido pelo `payments-service` e consumido pelo `orders-service`.

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
