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
         Postgres     MongoDB     Postgres      Postgres     (sem banco)
                         │              │             │            ▲
                         └──────────► Kafka ◄─────────┴────────────┘
```

### Saga de um pedido

```text
Storefront ──POST /orders──► Orders (PENDING) ──order.created──► Catalog reserva estoque
                                                                   │
                     stock.rejected ◄── estoque insuficiente ──────┤
                     (Orders cancela)                              │ stock.reserved
                                                                   ▼
                                                   Payments cobra (limite configurável)
                                                     │                        │
                                         payment.approved             payment.rejected
                                         Orders confirma              Orders cancela
                                         Catalog efetiva estoque      Catalog libera reserva
```

Notifications observa todos esses eventos e avisa o cliente. O contrato completo
(tópicos, formatos, DLT e transições de estado) está em [`docs/events.md`](docs/events.md).

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
| Orquestração | Kubernetes (Minikube/Kind) com Kustomize |
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
│   └── notifications-service/ # Node + Kafka (sem banco)
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

> Se a porta 5432 ou 27017 já estiver ocupada, defina `POSTGRES_PORT`/`MONGO_PORT` em
> `infra/.env` e ajuste as URLs nos `.env` dos serviços.

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
| catalog-service, notifications-service | `npm test` |
| orders-service, payments-service | `.\mvnw test` |
| admin | `npx ng test --watch=false` |
| storefront | `npm run build` (checagem de tipos) |

## Kubernetes

Manifests Kustomize em [`k8s/`](k8s/README.md): `kubectl apply -k k8s/base` para a aplicação,
ou `kubectl apply -k k8s/overlays/observability` para incluir Prometheus, Grafana e Jaeger.

## Roadmap

- [x] Auth Service (Node + Postgres + JWT)
- [x] Catalog Service (Node + MongoDB)
- [x] API Gateway (proxy simples)
- [x] Storefront (React)
- [x] Orders Service (Java/Spring Boot)
- [x] Payments Service (Java/Spring Boot)
- [x] Integração via Kafka (eventos de pedido/pagamento)
- [x] Saga Pattern (orquestração pedidos ↔ pagamentos ↔ estoque)
- [x] Notifications Service (Node + Kafka)
- [x] Admin (Angular)
- [x] Observabilidade (Prometheus + Grafana + Jaeger)
- [x] Deploy em Kubernetes local (Minikube/Kind)

### Limitações conhecidas

- A Saga é **coreografada** (cada serviço reage a eventos), não orquestrada por um coordenador.
- Confirmar/cancelar um pedido `PENDING` manualmente no Admin não publica evento: não desfaz
  reservas de estoque nem cobranças já feitas pelos outros serviços.
- O Notifications Service guarda o feed em memória: ele recomeça vazio a cada reinício.
- O preço é copiado do catálogo na criação do pedido; não há carrinho persistido no servidor.

## Licença

MIT
