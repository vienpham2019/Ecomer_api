"use strict";

const { BadRequestError } = require("../core/error.response");
const { createOrder } = require("../models/order/order.repo");

class OrderService {
  // Get
  // Create
  static async createOrder({
    userId,
    order_checkout,
    order_shipping,
    order_payment,
    products,
  }) {
    if (products.length) {
      throw new BadRequestError("Empty product");
    }

    return await createOrder({
      userId,
      order_checkout,
      order_shipping,
      order_payment,
      products,
    });
  }
  // Update
  // Delete
}

module.exports = OrderService;
