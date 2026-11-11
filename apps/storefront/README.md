# ShopMesh Storefront

Loja React com catálogo e autenticação integrados exclusivamente pelo API Gateway.

## Setup

Na pasta `apps/storefront`, configure a URL da API (opcional; o padrão é `http://localhost:3000`), instale as dependências e rode o Vite. No container, a URL vem de `SHOPMESH_API_URL`, gravada em `config.js` pelo Nginx na inicialização (a mesma imagem serve qualquer ambiente):

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Antes, inicie a infraestrutura com `docker compose -f infra/docker-compose.yml up -d` na raiz e suba os serviços e o API Gateway conforme os READMEs de cada um. Para comprar, toda a Saga precisa estar no ar (Orders, Catalog, Payments e Kafka).

## Rotas

- `/`: catálogo com paginação.
- `/products/:id`: detalhes do produto.
- `/login`: autenticação; o token é mantido no contexto e no `localStorage`. Redireciona de volta à página que pediu login.
- `/register`: cadastro de cliente.
- `/cart`: sacola (persistida no `localStorage`) e finalização do pedido.
- `/orders`: pedidos do usuário e feed de notificações (requer login).
- `/orders/:id`: acompanhamento da Saga em tempo real (estoque, pagamento, confirmação), atualizado por polling enquanto o pedido está `PENDING`.

Quando o gateway responde `401` a uma requisição autenticada (token expirado), a sessão local é encerrada.
