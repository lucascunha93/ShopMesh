# ShopMesh Admin

Painel administrativo do ShopMesh em Angular 22 (componentes standalone, signals e
detecção de mudanças zoneless). Toda a comunicação passa pelo API Gateway.

## Setup

```powershell
cd apps/admin
npm install
npm start          # http://localhost:4200
```

Entre com a conta criada pelo Auth Service a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
Contas `CUSTOMER` são recusadas no login.

A URL do gateway vem de `window.SHOPMESH_API_URL` (`public/config.js`). Em desenvolvimento
fica vazia e o padrão é `http://localhost:3000`; no container, o Nginx reescreve o
arquivo a partir da variável `SHOPMESH_API_URL`.

## Telas

| Rota | O que faz |
|---|---|
| `/` | Indicadores (pedidos por status, produtos, usuários), pedidos recentes e últimas notificações |
| `/orders` | Todos os pedidos com filtro por status e paginação (estado na URL) |
| `/orders/:id` | Itens, pagamento e motivo; confirmar/cancelar manualmente pedidos `PENDING` |
| `/products` | Catálogo completo (inclui inativos) com estoque, reservado e disponível; ativar/desativar |
| `/products/new`, `/products/:id/edit` | Criar e editar produtos (o estoque não pode ficar abaixo do reservado) |
| `/users` | Usuários cadastrados |
| `/notifications` | Notificações enviadas pelo Notifications Service |

## Estrutura

```
src/app/
├── core/       # AuthService (signals), interceptor JWT, guards, clientes da API e modelos
├── layout/     # Shell com a navegação lateral
├── shared/     # Badge de status e paginação
└── features/   # Uma pasta por tela, carregada sob demanda (lazy loading)
```

## Testes e build

```powershell
npx ng test --watch=false
npx ng build
```
