import { Routes } from '@angular/router';
import { adminGuard, guestGuard } from './core/auth.guard';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Entrar | ShopMesh Admin',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    component: Shell,
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        title: 'Visão geral | ShopMesh Admin',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'orders',
        title: 'Pedidos | ShopMesh Admin',
        loadComponent: () => import('./features/orders/orders-list').then((m) => m.OrdersList),
      },
      {
        path: 'orders/:id',
        title: 'Pedido | ShopMesh Admin',
        loadComponent: () => import('./features/orders/order-detail').then((m) => m.OrderDetail),
      },
      {
        path: 'products',
        title: 'Produtos | ShopMesh Admin',
        loadComponent: () => import('./features/products/products-list').then((m) => m.ProductsList),
      },
      {
        path: 'products/new',
        title: 'Novo produto | ShopMesh Admin',
        loadComponent: () => import('./features/products/product-form').then((m) => m.ProductForm),
      },
      {
        path: 'products/:id/edit',
        title: 'Editar produto | ShopMesh Admin',
        loadComponent: () => import('./features/products/product-form').then((m) => m.ProductForm),
      },
      {
        path: 'users',
        title: 'Usuários | ShopMesh Admin',
        loadComponent: () => import('./features/users/users-list').then((m) => m.UsersList),
      },
      {
        path: 'notifications',
        title: 'Notificações | ShopMesh Admin',
        loadComponent: () =>
          import('./features/notifications/notifications-list').then((m) => m.NotificationsList),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
