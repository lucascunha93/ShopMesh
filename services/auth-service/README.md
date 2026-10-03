# Auth Service

Serviço de autenticação e usuários do ShopMesh, construído com Node.js, Express, Prisma e PostgreSQL.

## Executar localmente

Na raiz do repositório, inicie o PostgreSQL:

```bash
docker compose -f infra/docker-compose.yml up -d postgres
```

Na pasta `services/auth-service`, copie `.env.example` para `.env` e ajuste `JWT_SECRET` para um segredo aleatório. Depois instale dependências, aplique a migração e inicie em modo de desenvolvimento:

```bash
npm install
npm run prisma:migrate
npm run dev
```

Na primeira execução, informe `init` quando o Prisma solicitar o nome da migração.

O serviço estará disponível em `http://localhost:3001`. O healthcheck está em `GET /health`.

## Endpoints

### Registrar usuário

```bash
curl -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Silva","email":"ana@example.com","password":"senha-segura"}'
```

### Login

```bash
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"senha-segura"}'
```

### Consultar usuário autenticado

Substitua `<token>` pelo token retornado no registro ou login.

```bash
curl http://localhost:3001/me \
  -H "Authorization: Bearer <token>"
```
