# Contrato de eventos — Versão 2

Este documento é a fonte de verdade para a comunicação assíncrona entre os
serviços. Cada serviço implementa sua própria representação do evento; o
contrato compartilhado é o JSON, não classes Java ou JavaScript compartilhadas.

## Tópicos

| Tópico | Produtor | Consumidor |
| --- | --- | --- |
| `order.created` | `orders-service` | `catalog-service`, `notifications-service` |
| `order.cancelled` | `orders-service` | `catalog-service`, `notifications-service` |
| `stock.reserved` | `catalog-service` | `payments-service` |
| `stock.rejected` | `catalog-service` | `orders-service`, `notifications-service` |
| `payment.approved` | `payments-service` | `orders-service`, `catalog-service`, `notifications-service` |
| `payment.rejected` | `payments-service` | `orders-service`, `catalog-service`, `notifications-service` |
| `<tópico>.DLT` | Serviço que rejeita a mensagem | Operação/diagnóstico do serviço responsável |

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

## Semântica da Saga de estoque

```text
orders-service
    |
    | ORDER_CREATED
    v
catalog-service -- estoque reservado --> STOCK_RESERVED --> payments-service
    |                                                        |
    | estoque insuficiente                                 | pagamento aprovado
    v                                                        v
STOCK_REJECTED --> orders-service                    PAYMENT_APPROVED
                       |                              /             \
                       | cancela pedido              v               v
                       |                    orders-service   catalog-service
                       |                    confirma pedido  efetiva reserva
                       |
                       |                         PAYMENT_REJECTED
                       |                         /             \
                       |                        v               v
                       |               orders-service   catalog-service
                       |               cancela pedido   libera reserva
                       v
                 pedido finalizado
```

| Passo | Ação | Sucesso | Falha | Compensação |
| --- | --- | --- | --- | --- |
| 1. Reservar estoque (`catalog-service`) | Verifica disponibilidade e reserva as unidades solicitadas. | Publica `STOCK_RESERVED` em `stock.reserved`. | Publica `STOCK_REJECTED` em `stock.rejected`; o `orders-service` cancela o pedido. | Nada a desfazer: nenhuma reserva foi criada. |
| 2. Cobrar (`payments-service`) | Processa o pagamento após receber `STOCK_RESERVED`. | Publica `PAYMENT_APPROVED` em `payment.approved`. | Publica `PAYMENT_REJECTED` em `payment.rejected`; o `orders-service` cancela o pedido. | O `catalog-service` libera a reserva. |
| 3. Confirmar (`orders-service`) | Confirma o pedido ao receber `PAYMENT_APPROVED`. | O `catalog-service` efetiva a reserva ao receber o mesmo `PAYMENT_APPROVED`. | — | — |

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
`payments-service`. `userId` e `totalAmount` são repassados sem alteração do
`ORDER_CREATED`; o Catalog não é dono desses dados e os inclui para que Payments
não precise obtê-los de outra fonte.

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

Produzido pelo `payments-service` e consumido pelo `orders-service` e pelo
`catalog-service`. Orders confirma o pedido; Catalog efetiva a reserva. O evento
mantém o formato da versão 1.

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

Produzido pelo `payments-service` e consumido pelo `orders-service` e pelo
`catalog-service`. Orders cancela o pedido; Catalog libera a reserva. O evento
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

Produzido pelo `orders-service` somente quando um administrador cancela
manualmente um pedido `PENDING` (cancelamentos da própria Saga já são
propagados por `stock.rejected` e `payment.rejected`). O `catalog-service`
libera a reserva de estoque, se existir; o `notifications-service` avisa o
cliente. `reason` pode ser `null`.

Se o pagamento ainda estiver em andamento, um `payment.approved` tardio é
ignorado pelo Orders (pedido já cancelado) e pelo Catalog (reserva já liberada);
o estorno da cobrança não é automatizado.

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
  pelo Admin), consumido por Catalog e Notifications.
