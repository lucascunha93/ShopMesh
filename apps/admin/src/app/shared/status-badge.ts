import { Component, computed, input } from '@angular/core';
import { OrderStatus } from '../core/models';

const LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
};

@Component({
  selector: 'app-status-badge',
  template: `<span [class]="'badge badge--' + status().toLowerCase()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<OrderStatus>();
  protected readonly label = computed(() => LABELS[this.status()]);
}
