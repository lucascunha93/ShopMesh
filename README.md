# ShopMesh

E-commerce de estudo construído em **arquitetura de microserviços poliglota**, com foco em:

- Comunicação síncrona (REST) e assíncrona (eventos)
- Consistência de dados distribuída (Saga Pattern)
- Observabilidade (logs, métricas e tracing distribuído)
- Deploy containerizado (Docker → Kubernetes)

> Projeto pessoal de estudo/portfólio. Não é um produto em produção.

## Arquitetura

```
                     ┌──────────────┐        ┌──────────────┐
                     │  Storefront  │        │    Admin     │
                     │   (React)    │        │  (Angular)   │
                     └──────┬───────┘        └──────┬───────┘
                            │                        │
                            └───────────┬────────────┘
                                        │
                                ┌───────▼────────┐
                                │  API Gateway    │
                                └───────┬────────┘
              ┌─────────┬──────────────┼──────────────┬─────────┐
              │         │              │              │         │
        ┌─────▼───┐ ┌───▼─────┐  ┌─────▼────┐  ┌──────▼───┐ ┌───▼──────┐
        │  Auth   │ │Catálogo │  │ Pedidos  │  │Pagamentos│ │Notificaç.│
        │ (Node)  │ │ (Node)  │  │ (Java)   │  │ (Java)   │ │ (Node)   │
        └────┬────┘ └────┬────┘  └────┬─────┘  └────┬─────┘ └────┬─────┘
             │           │            │             │            │
         Postgres     MongoDB     Postgres      Postgres      MongoDB
                         │              │             │            ▲
                         └──────────► Kafka ◄─────────┴────────────┘
```

### Saga de um pedido (orquestrada pelo Orders)

O Orders é o **orquestrador**: a cada resposta ele decide o próximo passo e envia
*comandos* para Catalog e Payments, que só respondem a ele.

```text
Storefront ──POST /orders──► Orders (PENDING) ──order.created──► Catalog reserva estoque
                                  ▲                                  │
                                  ├──── stock.rejected ◄─────────────┤ (sem estoque: Orders cancela)
                                  └──── stock.reserved ◄─────────────┘
                                  │
                                  ├── payment.requested ──► Payments cobra (limite configurável)
                                  │                            │
                                  ├◄─ payment.approved ────────┤  Orders confirma ── stock.commit ──► Catalog efetiva
                                  └◄─ payment.rejected ────────┘  Orders cancela  ── stock.release ─► Catalog libera

Cancelamento manual no Admin: Orders cancela, envia stock.release e publica order.cancelled.
Se um payment.approved chegar depois, Orders envia payment.refund.requested e Payments estorna.
```

Notifications observa os eventos (`order.created`, `order.confirmed`, `order.cancelled`,
`stock.rejected`, `payment.rejected`, `payment.refunded`) e avisa o cliente, guardando o feed
no MongoDB. O contrato completo (tópicos, formatos, DLT e transições de estado) está em
[`docs/events.md`](docs/events.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Storefront (loja) | React 19 + Vite + Tailwind |
| Admin (backoffice) | Angular 22 (standalone, signals, zoneless) |
| Auth / Catálogo / Notificações / Gateway | Node.js + Express 5 |
| Pedidos / Pagamentos | Java 21 + Spring Boot 3.4 |
| Mensageria | Apache Kafka 4 (KRaft) |
| Bancos | PostgreSQL 16, MongoDB 7 |
| Infra local | Docker + Docker Compose |
| Orquestração | Kubernetes (kind/Minikube/Docker Desktop) com Kustomize |
| Observabilidade | Prometheus, Grafana, Jaeger (OpenTelemetry) |

## Estrutura do repositório

```
shopmesh/
├── apps/
│   ├── storefront/            # React — loja, sacola, checkout e pedidos
│   └── admin/                 # Angular — painel administrativo
├── gateway/                   # API Gateway (Express + http-proxy-middleware)
├── services/
│   ├── auth-service/          # Node + Prisma + Postgres (JWT HS256)
│   ├── catalog-service/       # Node + Mongo + Kafka (reserva de estoque da Saga)
│   ├── orders-service/        # Java + Postgres + Kafka
│   ├── payments-service/      # Java + Postgres + Kafka
│   └── notifications-service/ # Node + Kafka + Mongo (feed de notificações)
├── infra/                     # docker-compose e configs de Prometheus/Grafana
├── k8s/                       # manifests Kustomize (base + observabilidade)
├── docs/events.md             # contrato dos eventos Kafka
└── scripts/                   # smoke test e build de imagens
```

## Como rodar localmente

### Opção A — tudo em containers

```powershell
Copy-Item infra/.env.example infra/.env   # troque JWT_SECRET e ADMIN_PASSWORD
cd infra
docker compose --profile apps up -d --build
# opcional: métricas e traces (defina TRACING_ENABLED=true em infra/.env)
docker compose --profile apps --profile observability up -d
```

### Opção B — infraestrutura em containers, serviços no host

Útil para desenvolver um serviço por vez. Suba só a infra:

```powershell
docker compose -f infra/docker-compose.yml up -d
```

Depois inicie cada serviço conforme o README dele (`npm run dev` ou `.\mvnw spring-boot:run`).
Todos os serviços precisam do **mesmo** `JWT_SECRET` (mínimo de 32 caracteres).

> Se a porta 5432, 27017 ou 3001 já estiver ocupada, defina `POSTGRES_PORT`/`MONGO_PORT`/`AUTH_PORT`
> em `infra/.env` (ajuste as URLs nos `.env` dos serviços se rodá-los no host).

### Endereços

| O quê | URL |
|---|---|
| Storefront | http://localhost:5173 |
| Admin | http://localhost:4200 (login com `ADMIN_EMAIL`/`ADMIN_PASSWORD`) |
| API Gateway | http://localhost:3000 |
| Kafka UI | http://localhost:8090 |
| Grafana | http://localhost:3100 (dashboard "ShopMesh — Visão geral") |
| Prometheus | http://localhost:9090 |
| Jaeger | http://localhost:16686 |

O Auth Service cria o administrador inicial a partir de `ADMIN_EMAIL` e `ADMIN_PASSWORD`
(se o email já existir, a conta só é promovida a `ADMIN`).

### Smoke test

Com a stack no ar, valida a Saga de ponta a ponta pelo gateway (aprovação, rejeição de
pagamento, falta de estoque, estoque final e notificações):

```powershell
.\scripts\smoke-test.ps1 -AdminEmail admin@shopmesh.local -AdminPassword <senha>
```

### Testes automatizados

| Projeto | Comando |
|---|---|
| catalog-service, notifications-service, auth-service, gateway | `npm test` |
| orders-service, payments-service | `.\mvnw test` |
| admin | `npx ng test --watch=false` |
| storefront | `npm test` (Vitest) e `npm run build` (checagem de tipos) |

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda todos esses testes, os
builds dos frontends e, ao final, sobe a stack com Docker Compose e executa o smoke test.

## Kubernetes

Manifests Kustomize em [`k8s/`](k8s/README.md), validados em um cluster `kind` local com Ingress NGINX:

```powershell
kind create cluster --config k8s/kind-config.yaml       # ou habilite o Kubernetes no Docker Desktop / minikube start
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.0/deploy/static/provider/kind/deploy.yaml
.\scripts\build-images.ps1 -Load kind -KindCluster shopmesh   # gera e carrega as imagens no cluster
Copy-Item k8s/base/secrets.env.example k8s/base/secrets.env   # troque os valores
kubectl apply -k k8s/base                               # aplicação (use k8s/overlays/observability para incluir Prometheus, Grafana e Jaeger)
```

O passo a passo completo (segredos, Ingress, `hosts` e port-forwards) está em [`k8s/README.md`](k8s/README.md).

## Roadmap

- [x] Auth Service (Node + Postgres + JWT)
- [x] Catalog Service (Node + MongoDB)
- [x] API Gateway (proxy simples)
- [x] Storefront (React)
- [x] Orders Service (Java/Spring Boot)
- [x] Payments Service (Java/Spring Boot)
- [x] Integração via Kafka (eventos de pedido/pagamento)
- [x] Saga Pattern (orquestrada pelo Orders: pedidos ↔ pagamentos ↔ estoque, com estorno)
- [x] Notifications Service (Node + Kafka + MongoDB)
- [x] Admin (Angular)
- [x] Observabilidade (Prometheus + Grafana + Jaeger)
- [x] Deploy em Kubernetes local (kind/Minikube/Docker Desktop)
- [x] Carrinho persistido no servidor (Orders) e sincronizado pelo Storefront
- [x] Testes automatizados em todos os serviços, testes de integração com Testcontainers e CI

### Limitações conhecidas

- O estorno é simulado: o Payments só muda o pagamento para `REFUNDED` (não há gateway real).
- Cancelar manualmente um pedido no Admin só vale para pedidos `PENDING`; confirmar manualmente
  não cobra nada. Ambos são atalhos de backoffice, sem tela para refazer a Saga.
- O preço é copiado do catálogo na criação do pedido e o carrinho guarda o preço do momento em
  que o item foi adicionado; o total oficial é sempre recalculado pelo Orders.
- As notificações expiram do MongoDB após 30 dias (índice TTL).

## Licença

MIT
