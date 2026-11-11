const mongoose = require('mongoose');

const productReservationSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
}, {
  _id: false,
});

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    default: 'geral',
  },
  stock: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Unidades seguradas por pedidos em andamento na Saga de estoque.
  reserved: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Reservas por pedido: permitem reservar, efetivar e liberar de forma
  // atômica e idempotente em um único documento.
  reservations: {
    type: [productReservationSchema],
    default: [],
    select: false,
  },
  imageUrl: {
    type: String,
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      delete ret.reservations;
      delete ret.id;
      return ret;
    },
  },
});

productSchema.virtual('availableStock').get(function availableStock() {
  return Math.max((this.stock || 0) - (this.reserved || 0), 0);
});

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ 'reservations.orderId': 1 });

module.exports = mongoose.model('Product', productSchema);
