# ShopMesh Storefront

Loja React com catálogo e autenticação integrados exclusivamente pelo API Gateway.

## Setup

Na pasta `apps/storefront`, configure a URL da API (opcional; o padrão é `http://localhost:3000`), instale as dependências e rode o Vite:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Antes, inicie o Postgres e Mongo com `docker compose -f infra/docker-compose.yml up -d` na raiz e suba Auth Service, Catalog Service e API Gateway conforme os READMEs de cada serviço.

## Rotas

- `/`: catálogo com paginação.
- `/products/:id`: detalhes do produto.
- `/login`: autenticação; o token é mantido no contexto e no `localStorage`.
