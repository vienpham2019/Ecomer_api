"use strict";
const { convertToObjectIdMongoDB } = require("../../utils");
const inventoryModel = require("./inventory.model");

// Create
const createInventory = async ({
  productId,
  shopId,
  stock,
  location = "unknow",
}) => {
  return await inventoryModel.create({
    inven_productId: productId,
    inven_stock: stock,
    inven_shopId: shopId,
    inven_location: location,
  });
};

// Update
const reservationInventory = async ({ productId, quantity, cartId }) => {
  const query = {
    inven_productId: convertToObjectIdMongoDB(productId),
    inven_stock: { $gte: quantity },
  };
  const updateSet = {
    $inc: {
      inven_stock: -quantity,
    },
    $push: {
      inven_reservations: {
        quantity,
        cartId,
        createOn: new Date(),
      },
    },
  };
  const options = { upsert: true, new: true };
  return await inventoryModel.updateOne(query, updateSet, options);
};

// Delete
const deleteInventory = async ({ productId, shopId }) => {
  const filter = { inven_productId: productId, inven_shopId: shopId };
  return inventoryModel.deleteOne(filter);
};

module.exports = {
  createInventory,
  reservationInventory,
  deleteInventory,
};
