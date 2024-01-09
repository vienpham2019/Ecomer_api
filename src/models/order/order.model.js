"use strict";

const { Schema, model } = require("mongoose"); // Erase if already required
const { OrderStatus } = require("./order.enum");
const DOCUMENT_NAME = "Order";
const COLLECTION_NAME = "Orders";

const order_checkoutSchema = new Schema(
  {
    totalPrice: Number,
    totalAllyDiscount: Number,
    feeShip: Number,
  },
  { _id: false }
);
const order_shippingSchema = new Schema(
  {
    street: String,
    city: String,
    state: String,
    country: String,
  },
  { _id: false }
);
const orderSchema = new Schema(
  {
    order_userId: { type: Schema.ObjectId, ref: "User", required: true },
    order_checkout: { type: order_checkoutSchema, default: {} },
    order_shipping: { type: order_shippingSchema, default: {} },
    order_payment: { type: Object, default: {} },
    order_products: { type: Array, default: [] },
    order_trackingNumber: { type: String, required: true },
    order_status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);
//Export the model
module.exports = model(DOCUMENT_NAME, orderSchema);
