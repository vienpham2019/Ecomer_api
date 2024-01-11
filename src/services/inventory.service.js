"use strict";

const { NotFoundError } = require("../core/error.response");
const {
  createInventory,
  reservationInventory,
} = require("../models/inventory/inventory.repo");
const { findProductByShopId } = require("../models/product/product.repo");

class InventoryService {
  // Get
  // Create
  static async createInventory({ productId, shopId, stock, location }) {
    const foundProduct = await findProductByShopId({ productId, shopId });
    if (!foundProduct) throw new NotFoundError(`Product Not Found`);

    return await createInventory({ productId, shopId, stock, location });
  }
  // Update
  static async reservationInventory({ productId, quantity, cartId }) {
    return await reservationInventory({ productId, quantity, cartId });
  }
  // Delete
}

module.exports = InventoryService;
