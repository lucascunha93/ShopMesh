const mongoose = require('mongoose');

const SAGA_STATUS = Object.freeze({
  PROCESSING: 'PROCESSING',
  RESERVED: 'RESERVED',
  REJECTED: 'REJECTED',
  COMMITTED: 'COMMITTED',
  RELEASED: 'RELEASED',
});

// Transições permitidas, conforme docs/events.md.
const ALLOWED_TRANSITIONS = Object.freeze({
  [SAGA_STATUS.PROCESSING]: [SAGA_STATUS.RESERVED, SAGA_STATUS.REJECTED],
  [SAGA_STATUS.RESERVED]: [SAGA_STATUS.COMMITTED, SAGA_STATUS.RELEASED],
  [SAGA_STATUS.REJECTED]: [],
  [SAGA_STATUS.COMMITTED]: [],
  [SAGA_STATUS.RELEASED]: [],
});

function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

const reservationItemSchema = new mongoose.Schema({
  productId: {
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

const stockReservationSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: String,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  items: {
    type: [reservationItemSchema],
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(SAGA_STATUS),
    required: true,
    default: SAGA_STATUS.PROCESSING,
  },
  reason: {
    type: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('StockReservation', stockReservationSchema);
module.exports.SAGA_STATUS = SAGA_STATUS;
module.exports.canTransition = canTransition;
