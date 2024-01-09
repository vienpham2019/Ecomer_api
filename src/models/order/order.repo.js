"use strict";

const orderModel = require("./order.model");

// Get
// Create
const createOrder = async ({
  userId,
  order_checkout,
  order_shipping,
  order_payment,
  products,
}) => {
  return await orderModel.create({
    order_userId: userId,
    order_checkout,
    order_shipping,
    order_payment,
    order_products: products,
  });
};
// Update
// Delete

module.exports = { createOrder };
