# ShopMesh — Contexto do projeto

E-commerce de estudo em arquitetura de microserviços poliglota, usado para aprender
comunicação síncrona/assíncrona entre serviços, padrões de consistência distribuída
(Saga) e observabilidade.

## Stack e decisões de arquitetura (não mude sem perguntar)

- Dois frontends: Storefront em **React** (cliente final) e Admin em **Angular** (backoffice).
- Backend poliglota, dividido por natureza do domínio:
  - Auth/Users: Node.js + Express + PostgreSQL (Prisma)
  - Catálogo: Node.js + Express + MongoDB (Mongoose)
  - Pedidos: Java + Spring Boot + PostgreSQL
  - Pagamentos: Java + Spring Boot + PostgreSQL
  - Notificações: Node.js, orientado a evento, sem banco próprio
  - API Gateway: Node.js (proxy)
- Comunicação assíncrona via Kafka (fases seguintes).
- Saga Pattern para consistência entre Pedidos ↔ Pagamentos ↔ Estoque (fases seguintes).
- Observabilidade: Prometheus + Grafana + Jaeger (fase final).
- Docker + Docker Compose localmente. Tudo gratuito e local, sem dependência de serviço pago.

## Estrutura de pastas (sempre seguir)

shopmesh/ ├── infra/ # docker-compose, configs de infra ├── services/ │ ├── auth-service/ # Node.js │ ├── catalog-service/ # Node.js │ ├── orders-service/ # Java / Spring Boot │ ├── payments-service/ # Java / Spring Boot │ └── notifications-service/ # Node.js ├── gateway/ # API Gateway └── apps/ ├── storefront/ # React └── admin/ # Angular


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
  `/products`), não com prefixo — o prefixo por domínio (`/auth`, `/catalog`) é
  responsabilidade do API Gateway, não do serviço em si.

## Ordem de construção (fatias verticais — não pule etapas nem implemente tudo de uma vez)

Fase atual (Parte 1): infra base → Auth Service → Catalog Service → API Gateway →
Storefront React consumindo o Gateway.

Fases seguintes (só depois da Parte 1 funcionar ponta a ponta): Orders Service →
Payments Service + Kafka → Saga Pattern → Admin Angular → Observabilidade → Kubernetes.

## Linguagem

Comentários de código e mensagens de commit em português. Nomes de variáveis/funções
em inglês (convenção usual de código).