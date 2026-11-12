const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockReservation = require('../models/StockReservation');
const { logInfo, logWarn } = require('../utils/logger');

const { SAGA_STATUS } = StockReservation;

// Um pedido pode repetir o mesmo produto em itens diferentes; a reserva é
// feita por produto, então as quantidades são somadas antes.
function aggregateItems(items) {
  const quantities = new Map();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  return [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

function isDuplicateKeyError(error) {
  return error && error.code === 11000;
}

function createStockService({ ProductModel = Product, ReservationModel = StockReservation } = {}) {
  async function findOrCreateSaga(event, items) {
    try {
      return await ReservationModel.findOneAndUpdate(
        { orderId: event.orderId },
        {
          $setOnInsert: {
            orderId: event.orderId,
            userId: event.userId,
            totalAmount: event.totalAmount,
            items,
            status: SAGA_STATUS.PROCESSING,
          },
        },
        { upsert: true, new: true },
      );
    } catch (error) {
      // Dois consumidores podem tentar o upsert ao mesmo tempo; o perdedor
      // recebe violação de unicidade e reutiliza o documento do vencedor.
      if (isDuplicateKeyError(error)) {
        return ReservationModel.findOne({ orderId: event.orderId });
      }
      throw error;
    }
  }

  async function transition(orderId, from, to, extra = {}) {
    const updated = await ReservationModel.findOneAndUpdate(
      { orderId, status: from },
      { $set: { status: to, ...extra } },
      { new: true },
    );
    return updated || ReservationModel.findOne({ orderId });
  }

  async function reserveProduct(orderId, { productId, quantity }) {
    if (!mongoose.isValidObjectId(productId) || !/^[0-9a-fA-F]{24}$/.test(productId)) {
      return { ok: false, reason: `Produto ${productId} não encontrado` };
    }

    const result = await ProductModel.updateOne(
      {
        _id: productId,
        active: true,
        'reservations.orderId': { $ne: orderId },
        $expr: {
          $gte: [{ $subtract: ['$stock', { $ifNull: ['$reserved', 0] }] }, quantity],
        },
      },
      {
        $inc: { reserved: quantity },
        $push: { reservations: { orderId, quantity } },
      },
    );

    if (result.modifiedCount === 1) {
      return { ok: true };
    }

    const product = await ProductModel.findById(productId).select('+reservations');
    if (!product || !product.active) {
      return { ok: false, reason: `Produto ${productId} não encontrado` };
    }

    // Reentrega do mesmo evento: a reserva deste pedido já existe.
    if ((product.reservations || []).some((reservation) => reservation.orderId === orderId)) {
      return { ok: true };
    }

    const available = Math.max(product.stock - (product.reserved || 0), 0);
    return {
      ok: false,
      reason: `Estoque insuficiente para ${product.name} (solicitado: ${quantity}, disponível: ${available})`,
    };
  }

  // Remove a reserva do pedido. Com commit=true também baixa o estoque físico.
  // O filtro pela reserva do pedido torna a operação idempotente.
  async function settleProduct(orderId, { productId, quantity }, { commit }) {
    if (!mongoose.isValidObjectId(productId)) {
      return;
    }

    const increments = commit
      ? { stock: -quantity, reserved: -quantity }
      : { reserved: -quantity };

    await ProductModel.updateOne(
      { _id: productId, 'reservations.orderId': orderId },
      {
        $inc: increments,
        $pull: { reservations: { orderId } },
      },
    );
  }

  async function reserveForOrder(event) {
    const items = aggregateItems(event.items);
    const saga = await findOrCreateSaga(event, items);

    if (saga.status !== SAGA_STATUS.PROCESSING) {
      logInfo('Reserva já processada para o pedido', { orderId: event.orderId, status: saga.status });
      return saga;
    }

    let failureReason = null;
    for (const item of saga.items) {
      const result = await reserveProduct(event.orderId, item);
      if (!result.ok) {
        failureReason = result.reason;
        break;
      }
    }

    if (failureReason) {
      // Desfaz qualquer reserva parcial antes de rejeitar o pedido.
      for (const item of saga.items) {
        await settleProduct(event.orderId, item, { commit: false });
      }
      logWarn('Estoque rejeitado para o pedido', { orderId: event.orderId, reason: failureReason });
      return transition(event.orderId, SAGA_STATUS.PROCESSING, SAGA_STATUS.REJECTED, { reason: failureReason });
    }

    logInfo('Estoque reservado para o pedido', { orderId: event.orderId });
    return transition(event.orderId, SAGA_STATUS.PROCESSING, SAGA_STATUS.RESERVED);
  }

  async function settleForOrder(orderId, targetStatus) {
    const saga = await ReservationModel.findOne({ orderId });

    if (!saga) {
      logWarn('Comando ignorado: reserva não encontrada', { orderId });
      return null;
    }

    if (!StockReservation.canTransition(saga.status, targetStatus)) {
      logInfo('Comando ignorado: transição não permitida', {
        orderId,
        status: saga.status,
        target: targetStatus,
      });
      return saga;
    }

    const commit = targetStatus === SAGA_STATUS.COMMITTED;
    for (const item of saga.items) {
      await settleProduct(orderId, item, { commit });
    }

    logInfo(commit ? 'Reserva efetivada' : 'Reserva liberada', { orderId });
    return transition(orderId, saga.status, targetStatus);
  }

  return {
    reserveForOrder,
    commitForOrder: (event) => settleForOrder(event.orderId, SAGA_STATUS.COMMITTED),
    releaseForOrder: (event) => settleForOrder(event.orderId, SAGA_STATUS.RELEASED),
  };
}

module.exports = { createStockService, aggregateItems };
