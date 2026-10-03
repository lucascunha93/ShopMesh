# Catalog Service

Serviço de catálogo do ShopMesh, construído com Node.js, Express, Mongoose e MongoDB.

## Executar localmente

Na raiz do repositório, inicie o MongoDB:

```bash
docker compose -f infra/docker-compose.yml up -d mongo
```

Na pasta `services/catalog-service`, copie `.env.example` para `.env`, instale as dependências e inicie o serviço:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

O serviço estará disponível em `http://localhost:3002`. O healthcheck está em `GET /health`.

## Endpoints

### Listar e buscar produtos

```bash
curl "http://localhost:3002/products?page=1&limit=20&category=geral&search=cafe"
```

Os parâmetros `page` e `limit` são opcionais (padrões `1` e `20`; limite máximo `100`). A busca usa o índice de texto de nome e descrição.

### Consultar produto por ID

```bash
curl http://localhost:3002/products/65a000000000000000000001
```

### Criar produto

```bash
curl -X POST http://localhost:3002/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Café especial","description":"Grãos selecionados","price":39.9,"category":"bebidas","stock":12,"imageUrl":"https://example.com/cafe.jpg"}'
```
