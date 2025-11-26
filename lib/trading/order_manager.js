/**
 * Order Manager
 *
 * Handles order placement, tracking, and fill confirmation for trade execution.
 * Provides a clean interface for placing market, stop loss, and take profit orders.
 */

const logger = require('../utils/logger');
const { sleep } = require('../utils/async');

/**
 * Place a market order and wait for fill
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {Object} orderParams - Order parameters
 * @returns {Promise<Object>} Filled order details
 */
async function placeMarketOrder(coinbaseClient, orderParams) {
  const { productId, side, size } = orderParams;

  try {
    logger.info('Placing market order', { productId, side, size });

    // Place the market order
    const orderResponse = await coinbaseClient.placeMarketOrder(
      productId,
      side,
      size
    );

    logger.info('Market order placed', {
      orderId: orderResponse.order_id,
      clientOrderId: orderResponse.client_order_id
    });

    // Wait for order to fill
    const filledOrder = await waitForOrderFill(
      coinbaseClient,
      orderResponse.order_id,
      30000 // 30 second timeout
    );

    return filledOrder;
  } catch (error) {
    logger.error('Failed to place market order', {
      error: error.message,
      orderParams
    });
    throw error;
  }
}

/**
 * Place a stop loss order
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {Object} orderParams - Stop loss parameters
 * @returns {Promise<Object>} Stop loss order details
 */
async function placeStopLossOrder(coinbaseClient, orderParams) {
  const { productId, side, size, stopPrice } = orderParams;

  try {
    logger.info('Placing stop loss order', {
      productId,
      side,
      size,
      stopPrice
    });

    const orderResponse = await coinbaseClient.placeStopLossOrder(
      productId,
      side,
      size,
      stopPrice
    );

    logger.info('Stop loss order placed', {
      orderId: orderResponse.order_id,
      stopPrice
    });

    return {
      orderId: orderResponse.order_id,
      clientOrderId: orderResponse.client_order_id,
      stopPrice: stopPrice,
      size: size,
      side: side,
      status: 'PENDING'
    };
  } catch (error) {
    logger.error('Failed to place stop loss order', {
      error: error.message,
      orderParams
    });
    throw error;
  }
}

/**
 * Place a take profit order (limit order)
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {Object} orderParams - Take profit parameters
 * @returns {Promise<Object>} Take profit order details
 */
async function placeTakeProfitOrder(coinbaseClient, orderParams) {
  const { productId, side, size, limitPrice } = orderParams;

  try {
    logger.info('Placing take profit order', {
      productId,
      side,
      size,
      limitPrice
    });

    const orderResponse = await coinbaseClient.placeTakeProfitOrder(
      productId,
      side,
      size,
      limitPrice
    );

    logger.info('Take profit order placed', {
      orderId: orderResponse.order_id,
      limitPrice
    });

    return {
      orderId: orderResponse.order_id,
      clientOrderId: orderResponse.client_order_id,
      limitPrice: limitPrice,
      size: size,
      side: side,
      status: 'PENDING'
    };
  } catch (error) {
    logger.error('Failed to place take profit order', {
      error: error.message,
      orderParams
    });
    throw error;
  }
}

/**
 * Wait for an order to fill
 *
 * Polls the order status until it is filled or times out.
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {string} orderId - Order ID to track
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Object>} Filled order with price and timestamp
 */
async function waitForOrderFill(coinbaseClient, orderId, timeout = 30000) {
  const startTime = Date.now();
  const pollInterval = 1000; // Check every 1 second

  logger.debug('Waiting for order fill', { orderId, timeout });

  while (Date.now() - startTime < timeout) {
    try {
      // Get order status
      const order = await coinbaseClient.getOrder(orderId);

      logger.debug('Order status checked', {
        orderId,
        status: order.status
      });

      // Check if order is filled
      if (order.status === 'FILLED') {
        logger.info('Order filled', {
          orderId,
          fillPrice: order.average_filled_price
        });

        return {
          orderId: order.order_id,
          status: 'FILLED',
          fillPrice: parseFloat(order.average_filled_price || order.filled_value / order.filled_size),
          filledSize: parseFloat(order.filled_size),
          timestamp: new Date(order.completion_time || Date.now()),
          fees: parseFloat(order.total_fees || 0)
        };
      }

      // Check if order failed or was canceled
      if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(order.status)) {
        throw new Error(`Order ${order.status.toLowerCase()}: ${order.reject_reason || 'Unknown reason'}`);
      }

      // Wait before next poll
      await sleep(pollInterval);
    } catch (error) {
      // If it's a timeout error from the API, retry
      if (error.message.includes('timeout')) {
        logger.warn('API timeout while checking order, retrying...', { orderId });
        await sleep(pollInterval);
        continue;
      }

      throw error;
    }
  }

  // Timeout reached
  throw new Error(`Order fill timeout after ${timeout}ms for order ${orderId}`);
}

/**
 * Get order status
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Order status details
 */
async function getOrderStatus(coinbaseClient, orderId) {
  try {
    const order = await coinbaseClient.getOrder(orderId);

    return {
      orderId: order.order_id,
      status: order.status,
      side: order.side,
      productId: order.product_id,
      filledSize: parseFloat(order.filled_size || 0),
      averagePrice: parseFloat(order.average_filled_price || 0),
      createdTime: new Date(order.created_time),
      completionTime: order.completion_time ? new Date(order.completion_time) : null
    };
  } catch (error) {
    logger.error('Failed to get order status', {
      error: error.message,
      orderId
    });
    throw error;
  }
}

/**
 * Cancel an order
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {string} orderId - Order ID to cancel
 * @returns {Promise<Object>} Cancellation result
 */
async function cancelOrder(coinbaseClient, orderId) {
  try {
    logger.info('Cancelling order', { orderId });

    const response = await coinbaseClient.cancelOrder(orderId);

    logger.info('Order cancelled', { orderId });

    return {
      orderId: orderId,
      cancelled: true,
      result: response
    };
  } catch (error) {
    logger.error('Failed to cancel order', {
      error: error.message,
      orderId
    });
    throw error;
  }
}

/**
 * Cancel multiple orders
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {Array<string>} orderIds - Array of order IDs to cancel
 * @returns {Promise<Object>} Cancellation results
 */
async function cancelOrders(coinbaseClient, orderIds) {
  try {
    logger.info('Cancelling orders', { count: orderIds.length });

    const response = await coinbaseClient.cancelOrders(orderIds);

    logger.info('Orders cancelled', { count: orderIds.length });

    return {
      orderIds: orderIds,
      cancelled: true,
      result: response
    };
  } catch (error) {
    logger.error('Failed to cancel orders', {
      error: error.message,
      count: orderIds.length
    });
    throw error;
  }
}

/**
 * Update stop loss order
 *
 * Cancels existing stop loss and places a new one at the new price.
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {string} currentStopOrderId - Existing stop order ID
 * @param {Object} newStopParams - New stop loss parameters
 * @returns {Promise<Object>} New stop loss order
 */
async function updateStopLoss(coinbaseClient, currentStopOrderId, newStopParams) {
  try {
    logger.info('Updating stop loss', {
      currentOrderId: currentStopOrderId,
      newStopPrice: newStopParams.stopPrice
    });

    // Cancel existing stop loss
    await cancelOrder(coinbaseClient, currentStopOrderId);

    // Wait a moment for cancellation to process
    await sleep(500);

    // Place new stop loss
    const newStopOrder = await placeStopLossOrder(coinbaseClient, newStopParams);

    logger.info('Stop loss updated', {
      oldOrderId: currentStopOrderId,
      newOrderId: newStopOrder.orderId,
      newStopPrice: newStopParams.stopPrice
    });

    return newStopOrder;
  } catch (error) {
    logger.error('Failed to update stop loss', {
      error: error.message,
      currentStopOrderId,
      newStopParams
    });
    throw error;
  }
}

/**
 * Close position at market price
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {string} productId - Product ID
 * @param {number} size - Position size to close
 * @param {string} side - 'BUY' or 'SELL'
 * @returns {Promise<Object>} Closed position details
 */
async function closePositionAtMarket(coinbaseClient, productId, size, side) {
  try {
    logger.info('Closing position at market', {
      productId,
      size,
      side
    });

    // Place market order to close position
    const closeOrder = await placeMarketOrder(coinbaseClient, {
      productId,
      side,
      size
    });

    logger.info('Position closed at market', {
      orderId: closeOrder.orderId,
      fillPrice: closeOrder.fillPrice
    });

    return closeOrder;
  } catch (error) {
    logger.error('Failed to close position at market', {
      error: error.message,
      productId,
      size,
      side
    });
    throw error;
  }
}

module.exports = {
  placeMarketOrder,
  placeStopLossOrder,
  placeTakeProfitOrder,
  waitForOrderFill,
  getOrderStatus,
  cancelOrder,
  cancelOrders,
  updateStopLoss,
  closePositionAtMarket
};
