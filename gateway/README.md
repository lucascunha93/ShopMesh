# API Gateway

Ponto de entrada HTTP para os serviços Auth, Catalog e Orders do ShopMesh.

## Executar localmente

Na raiz do repositório, inicie o MongoDB e PostgreSQL usados pelos serviços:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Em terminais separados, configure e inicie o Auth Service, o Catalog Service e o Orders Service conforme seus respectivos READMEs. Depois, na pasta `gateway`, copie `.env.example` para `.env`, instale as dependências e inicie o gateway:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Por padrão, o gateway escuta em `http://localhost:3000` e encaminha para Auth (`http://localhost:3001`), Catalog (`http://localhost:3002`) e Orders (`http://localhost:8081`). Os destinos podem ser configurados com `AUTH_SERVICE_URL`, `CATALOG_SERVICE_URL` e `ORDERS_SERVICE_URL`.

O prefixo de cada rota do gateway é removido antes de encaminhar a requisição. Por exemplo, `/api/orders/orders` chega ao Orders Service como `/orders`.

## Testar pelo gateway

### Auth Service

O storefront não tem uma tela de cadastro. Crie a conta pelo endpoint abaixo e depois entre em `/login` usando o mesmo email e senha:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Silva","email":"ana@example.com","password":"senha-segura"}'
```

Para testar o login pela API:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"senha-segura"}'
```

### Catalog Service

```bash
curl "http://localhost:3000/api/catalog/products?page=1&limit=12"
```

```bash
curl -X POST http://localhost:3000/api/catalog/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Café especial","price":39.9,"category":"bebidas","stock":12}'
```

### Orders Service

Faça login pelo Auth Service e use o JWT retornado no header `Authorization`. Este exemplo lista os pedidos do usuário autenticado:

```bash
curl http://localhost:3000/api/orders/orders \
  -H "Authorization: Bearer <token-valido>"
```

O gateway encaminha a requisição para `http://localhost:8081/orders`. Configure `ORDERS_SERVICE_URL` para alterar o destino.

### Health do gateway

```bash
curl http://localhost:3000/health
```
