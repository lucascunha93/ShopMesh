# ShopMesh — Contexto do projeto

E-commerce de estudo em arquitetura de microserviços poliglota, usado para aprender
comunicação síncrona/assíncrona entre serviços, padrões de consistência distribuída
(Saga) e observabilidade.

Todas as fases do roadmap estão concluídas (ver `README.md`). Mudanças novas devem
manter o que já funciona: rode os testes do serviço alterado e o smoke test
(`scripts/smoke-test.ps1`) antes de considerar uma tarefa pronta.

## Stack e decisões de arquitetura (não mude sem perguntar)

- Dois frontends: Storefront em **React** (cliente final) e Admin em **Angular** (backoffice).
- Backend poliglota, dividido por natureza do domínio:
  - Auth/Users: Node.js + Express + PostgreSQL (Prisma)
  - Catálogo: Node.js + Express + MongoDB (Mongoose)
  - Pedidos: Java + Spring Boot + PostgreSQL (orquestrador da Saga; também guarda o carrinho)
  - Pagamentos: Java + Spring Boot + PostgreSQL
  - Notificações: Node.js, orientado a evento, feed persistido em MongoDB (`MONGO_URI`;
    sem ela cai para memória, usado nos testes)
  - API Gateway: Node.js (proxy)
- Comunicação assíncrona via Kafka. O contrato de tópicos/eventos é a fonte de verdade em
  `docs/events.md`: qualquer mudança de evento atualiza esse documento.
- **Saga orquestrada pelo Orders**: o Orders decide cada passo e envia comandos
  (`payment.requested`, `stock.commit`, `stock.release`, `payment.refund.requested`);
  Catalog e Payments só respondem ao Orders, nunca reagem aos eventos um do outro.
  Consumidores são idempotentes (entrega at-least-once) e cada tópico consumido tem `.DLT`.
- Os tópicos são criados pelos próprios serviços (3 partições, 1 réplica); o broker tem
  auto-create desligado. Todo tópico novo precisa ser declarado (NewTopic no Java, admin no Node).
- Observabilidade: Prometheus + Grafana + Jaeger.
- Docker + Docker Compose localmente; Kubernetes local (kind/Minikube/Docker Desktop) com
  Kustomize em `k8s/`. Tudo gratuito e local, sem dependência de serviço pago.
- CI no GitHub Actions (`.github/workflows/ci.yml`): testes de cada serviço, builds dos
  frontends e smoke test com Docker Compose.

## Estrutura de pastas (sempre seguir)

```
shopmesh/
├── apps/
│   ├── storefront/            # React
│   └── admin/                 # Angular
├── gateway/                   # API Gateway
├── services/
│   ├── auth-service/          # Node.js
│   ├── catalog-service/       # Node.js
│   ├── orders-service/        # Java / Spring Boot
│   ├── payments-service/      # Java / Spring Boot
│   └── notifications-service/ # Node.js
├── infra/                     # docker-compose, configs de infra
├── k8s/                       # manifests Kustomize
├── docs/                      # contrato de eventos (events.md)
└── scripts/                   # smoke test e build de imagens
```

## Convenções de código (Node.js)

- CommonJS (`require`/`module.exports`), não ESM.
- Validação de entrada sempre com **zod**.
- Toda rota async envolvida por um helper `asyncHandler` (evita try/catch repetido).
- Error handler central no `app.js`, nunca deixar erro sem tratamento.
- Cada serviço expõe `GET /health` pra healthcheck.
- Senhas sempre com `bcryptjs`, nunca armazenar texto puro.
- JWT com payload mínimo (`sub` = id do usuário, `role`), segredo vindo de `.env`
  (nunca hardcoded).
- Cada serviço Node tem: `src/server.js` (entrypoint), `src/app.js` (Express app e
  middlewares), `src/routes/`, `src/controllers/`, `src/config/`, `src/utils/`.
- Cada serviço tem `Dockerfile`, `.env.example`, `.gitignore` (ignorando `node_modules`
  e `.env`) e `README.md` com instruções de setup e teste via curl.
- Rotas de negócio ficam expostas na **raiz** de cada serviço (ex: `/register`,
  `/products`, `/cart`), não com prefixo — o prefixo por domínio (`/auth`, `/catalog`) é
  responsabilidade do API Gateway, não do serviço em si.
- Testes com `node --test` (`npm test`), sem depender de serviços externos: use fakes em
  memória para banco/Kafka.

## Convenções de código (Java)

- Java 21 + Spring Boot 3.4; testes com `.\mvnw test`. Testes de integração usam
  Testcontainers (Kafka + PostgreSQL) com `disabledWithoutDocker = true`.
- Eventos publicados depois do commit da transação (`@TransactionalEventListener(AFTER_COMMIT)`).

## Frontends

- Storefront: testes com Vitest (`npm test`) e checagem de tipos com `npm run build`.
- Admin: testes com `npx ng test --watch=false`.
- Dockerfiles usam `node:24-alpine` (o Angular 22 exige Node 24).

## Linguagem

Comentários de código e mensagens de commit em português. Nomes de variáveis/funções
em inglês (convenção usual de código).
