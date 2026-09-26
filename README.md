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
                                        │             │            ▲
                                        └──────► Kafka ◄───────────┘
```

## Stack

| Camada | Tecnologia |
|---|---|
| Storefront (loja) | React (Vite/Next.js) |
| Admin (backoffice) | Angular |
| Auth / Catálogo / Notificações | Node.js + Express |
| Pedidos / Pagamentos | Java + Spring Boot |
| Mensageria | Apache Kafka |
| Bancos | PostgreSQL, MongoDB |
| Infra local | Docker + Docker Compose |
| Orquestração | Kubernetes (Minikube/Kind) |
| Observabilidade | Prometheus, Grafana, Jaeger |

## Estrutura do repositório

```
shopmesh/
├── infra/                  # docker-compose, configs de infra
├── services/
│   ├── auth-service/        # Node.js
│   ├── catalog-service/      # Node.js
│   ├── orders-service/       # Java / Spring Boot
│   ├── payments-service/     # Java / Spring Boot
│   └── notifications-service/# Node.js
├── gateway/                 # API Gateway
└── apps/
    ├── storefront/           # React
    └── admin/                # Angular
```

## Como rodar localmente

> Em construção — instruções detalhadas serão adicionadas conforme cada serviço for implementado.

```bash
cd infra
docker compose up -d
```

## Roadmap

- [ ] Auth Service (Node + Postgres + JWT)
- [ ] Catalog Service (Node + MongoDB)
- [ ] API Gateway (proxy simples)
- [ ] Storefront (React)
- [ ] Orders Service (Java/Spring Boot)
- [ ] Payments Service (Java/Spring Boot)
- [ ] Integração via Kafka (eventos de pedido/pagamento)
- [ ] Saga Pattern (orquestração pedidos ↔ pagamentos ↔ estoque)
- [ ] Admin (Angular)
- [ ] Observabilidade (Prometheus + Grafana + Jaeger)
- [ ] Deploy em Kubernetes local (Minikube/Kind)

## Licença

MIT
