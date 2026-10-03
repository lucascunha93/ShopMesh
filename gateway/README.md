# API Gateway

Ponto de entrada HTTP para o Auth Service e o Catalog Service do ShopMesh.

## Executar localmente

Na raiz do repositório, inicie o MongoDB e PostgreSQL usados pelos serviços:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Em terminais separados, configure e inicie o Auth Service e o Catalog Service conforme seus respectivos READMEs. Depois, na pasta `gateway`, copie `.env.example` para `.env`, instale as dependências e inicie o gateway:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Por padrão, o gateway escuta em `http://localhost:3000` e encaminha para `http://localhost:3001` e `http://localhost:3002`. Os destinos podem ser configurados com `AUTH_SERVICE_URL` e `CATALOG_SERVICE_URL`.

## Testar pelo gateway

### Auth Service

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Silva","email":"ana@example.com","password":"senha-segura"}'
```

### Catalog Service

```bash
curl http://localhost:3000/api/catalog/products?page=1&limit=20
```

```bash
curl -X POST http://localhost:3000/api/catalog/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Café especial","price":39.9,"category":"bebidas","stock":12}'
```

### Health do gateway

```bash
curl http://localhost:3000/health
```
