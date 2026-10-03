const mongoose = require('mongoose');

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
  imageUrl: {
    type: String,
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
