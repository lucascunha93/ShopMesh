# Orders Service

Serviço de pedidos do ShopMesh, implementado com Spring Boot 3, Java 21, Spring Data JPA e PostgreSQL.

## Configuração

O PostgreSQL local deve estar disponível em `localhost:5432`, com o banco `orders_db` e usuário/senha `shopmesh`. O serviço lê `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`, `JWT_SECRET`, `CATALOG_SERVICE_URL` e `PORT`; os valores locais estão em `.env.example`.

Copie `.env.example` para `.env` e ajuste `JWT_SECRET` para o **mesmo valor exato** de `JWT_SECRET` usado pelo Auth Service. Os dois serviços precisam compartilhar o segredo para que os tokens HS256 emitidos pelo Auth sejam aceitos aqui. O Spring não carrega `.env` automaticamente; exporte as variáveis no terminal ou configure-as no ambiente antes de executar o Maven Wrapper.

O script `infra/postgres-init/init-databases.sql` cria `orders_db` somente na primeira inicialização do volume de dados do Postgres. Se o volume já tiver sido inicializado antes da criação do banco, crie o banco manualmente ou recrie o volume conforme as instruções da raiz do projeto; essa recriação apaga também os dados locais de `auth_db`.

## Executar localmente

Inicie o Postgres na raiz do repositório e, dentro de `services/orders-service`, execute no PowerShell:

```powershell
.\mvnw spring-boot:run
```

O serviço escuta por padrão em `http://localhost:8081`. O `CATALOG_SERVICE_URL` padrão é `http://localhost:3002`.

## Token JWT para testes

Registre um usuário ou faça login pelo Auth Service e copie o campo `token` da resposta. O Auth assina o token com HS256, incluindo `sub` com o UUID do usuário e `role` (`CUSTOMER` ou `ADMIN`). Use o endpoint `POST /login` do Auth Service, por exemplo:

```powershell
curl.exe -X POST http://localhost:3001/login `
  -H "Content-Type: application/json" `
  -d '{"email":"ana@example.com","password":"senha-segura"}'
```

O `JWT_SECRET` do processo do Orders Service precisa ser exatamente igual ao configurado no Auth Service. Defina o token obtido nas instruções abaixo no lugar de `<token>`.

Para testar operações administrativas, registre um usuário e altere seu role no banco do Auth Service para `ADMIN`, por exemplo:

```powershell
docker exec shopmesh-postgres psql -U shopmesh -d auth_db -c "UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';"
```

## Endpoints

### Health (sem autenticação)

```powershell
curl.exe http://localhost:8081/health
```

Resposta: `{"status":"ok","service":"orders-service"}`.

### Criar pedido

Cada `productId` deve ser o ID string do produto no Catalog Service. O preço e o nome são copiados do catálogo no momento da compra.

```powershell
curl.exe -X POST http://localhost:8081/orders `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d '{"items":[{"productId":"<id-do-produto>","quantity":2}]}'
```

Um ID inexistente retorna `404` com o `productId` na mensagem e nenhum pedido é salvo:

```powershell
curl.exe -X POST http://localhost:8081/orders `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d '{"items":[{"productId":"produto-inexistente","quantity":1}]}'
```

Se o Catalog Service estiver indisponível, a resposta é `503`.

### Listar os próprios pedidos

O resultado é filtrado pelo `sub` do token. `page` começa em zero e `size` usa 20 por padrão.

```powershell
curl.exe "http://localhost:8081/orders?page=0&size=20" `
  -H "Authorization: Bearer <token>"
```

### Consultar um pedido

Um cliente pode consultar somente os próprios pedidos. Para demonstrar o `403`, autentique-se com o token de outro usuário e use um ID de pedido pertencente à primeira conta:

```powershell
curl.exe http://localhost:8081/orders/<id-do-pedido-de-outro-usuario> `
  -H "Authorization: Bearer <token-de-outro-usuario>"
```

Um usuário com role `ADMIN` pode consultar pedidos de outros usuários.

### Atualizar o status (ADMIN)

Somente `ADMIN` pode confirmar ou cancelar um pedido ainda `PENDING`.

```powershell
curl.exe -X PATCH http://localhost:8081/orders/<id-do-pedido>/status `
  -H "Authorization: Bearer <token-admin>" `
  -H "Content-Type: application/json" `
  -d '{"status":"CONFIRMED"}'
```

Também é possível enviar `"status":"CANCELLED"`. Tentar alterar novamente um pedido confirmado ou cancelado retorna `400`.

### Token ausente

Qualquer rota `/orders` exige um Bearer token. Sem token, o resultado é `401`:

```powershell
curl.exe http://localhost:8081/orders
```
