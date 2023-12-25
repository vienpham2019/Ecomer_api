"use strict";

const cartModel = require("./cart.model");
const { CartStateEnum } = require("./cart.enum");
const { convertToObjectIdMongoDB, getUnSelectData } = require("../../utils");

// Get
const getCartByUserId = async ({ userId }) => {
  return await cartModel.findOne({ cart_userId: userId });
};

const getCartByUserIdAndShopId = async ({ userId, shopId }) => {
  const query = {
    cart_userId: userId,
    "cart_orders.order_shopId": shopId,
    cart_state: CartStateEnum.ACTIVE,
  };
  return await cartModel.findOne(query).lean();
};

// Create
const addOrCreateCartWithOrder = async ({ userId, shopId }) => {
  const query = {
    cart_userId: userId,
    cart_state: CartStateEnum.ACTIVE,
  };
  const update = {
    $addToSet: {
      cart_orders: { order_shopId: shopId },
    },
  };
  const options = {
    upsert: true,
    new: true,
  };
  return await cartModel.findOneAndUpdate(query, update, options);
};

// Update
const updateProductQuantity = async ({
  userId,
  productId,
  shopId,
  inc_quantity,
}) => {
  const query = {
    cart_userId: userId,
    "cart_orders.order_shopId": shopId,
    "cart_orders.order_products.product_id": productId,
    cart_state: CartStateEnum.ACTIVE,
  };
  const updateSet = {
    $inc: {
      "cart_orders.$[orderElem].order_products.$[productElem].product_quantity":
        inc_quantity,
      "cart_orders.$[orderElem].order_products.$[productElem].product_oldQuantity":
        inc_quantity,
    },
  };
  const options = {
    arrayFilters: [
      { "orderElem.order_shopId": shopId },
      { "productElem.product_id": productId },
    ],
    new: true,
  };
  return await cartModel.findOneAndUpdate(query, updateSet, options);
};

const updateProductQuantityByAmount = async ({
  userId,
  product,
  quantityAmount,
}) => {
  const query = {
    cart_userId: userId,
    "cart_orders.order_shopId": product.product_shopId,
    "cart_orders.order_products.product_id": product.product_id,
    cart_state: CartStateEnum.ACTIVE,
  };
  const update = {
    $inc: {
      "cart_orders.$[orderElem].order_products.$[productElem].product_quantity":
        quantityAmount,
      "cart_orders.$[orderElem].order_products.$[productElem].product_oldQuantity":
        quantityAmount,
    },
  };
  const options = {
    arrayFilters: [
      { "orderElem.order_shopId": product.product_shopId },
      { "productElem.product_id": product.product_id },
    ],
    new: true,
  };
  await updateCartTotalByAmount({ userId, product, quantityAmount });
  return await cartModel.findOneAndUpdate(query, update, options);
};

const addProductToOrderProducts = async ({
  userId,
  product,
  unSelect = ["__v", "updatedAt", "createdAt", "_id"],
}) => {
  const existingProduct = await cartModel.findOne({
    cart_userId: userId,
    "cart_orders.order_shopId": product.product_shopId,
    "cart_orders.order_products.product_id": product.product_id,
    cart_state: CartStateEnum.ACTIVE,
  });

  if (existingProduct) {
    // If the product already exists in order_products, return the cart
    return await updateProductQuantityByAmount({
      userId,
      product,
      quantityAmount: 1,
    });
  }

  const query = {
    cart_userId: userId,
    "cart_orders.order_shopId": product.product_shopId,
    cart_state: CartStateEnum.ACTIVE,
  };
  const update = {
    $addToSet: {
      "cart_orders.$[orderElem].order_products": product,
    },
    $inc: {
      cart_count_product: 1,
    },
  };
  const options = {
    arrayFilters: [{ "orderElem.order_shopId": product.product_shopId }],
    new: true,
  };
  await updateCartTotalByAmount({ userId, product });
  return await cartModel
    .findOneAndUpdate(query, update, options)
    .select(getUnSelectData(unSelect));
};

const updateCartTotalByAmount = async ({
  userId,
  product,
  quantityAmount = 1,
  unSelect = ["__v", "updatedAt", "createdAt", "_id"],
}) => {
  const order_subtotal_inc =
    product.product_discountPrice === 0
      ? product.product_price
      : product.product_discountPrice;
  const cart_orderSubtotal_inc = product.product_price * quantityAmount;
  const cart_saleDiscount_inc =
    (product.product_price - order_subtotal_inc) * quantityAmount;
  console.log(
    order_subtotal_inc,
    cart_orderSubtotal_inc,
    cart_saleDiscount_inc
  );
  const query = {
    cart_userId: userId,
    "cart_orders.order_shopId": product.product_shopId,
    cart_state: CartStateEnum.ACTIVE,
  };
  const update = {
    $inc: {
      "cart_orders.$[orderElem].order_subtotal":
        order_subtotal_inc * quantityAmount,
      cart_orderSubtotal: cart_orderSubtotal_inc,
      cart_saleDiscount: cart_saleDiscount_inc,
      cart_grandTotal: cart_orderSubtotal_inc - cart_saleDiscount_inc,
    },
  };
  const options = {
    arrayFilters: [{ "orderElem.order_shopId": product.product_shopId }],
    new: true,
  };

  return await cartModel
    .findOneAndUpdate(query, update, options)
    .select(getUnSelectData(unSelect));
};

const removeProductFromUserCart = async ({
  userId,
  product,
  unSelect = ["__v", "updatedAt", "createdAt", "_id"],
}) => {
  await updateCartTotalByAmount({
    userId,
    product,
    quantityAmount: product.product_quantity * -1,
  });
  const rp_query = {
    cart_userId: userId,
    "cart_orders.order_shopId": product.product_shopId,
    cart_state: CartStateEnum.ACTIVE,
    "cart_orders.order_products.product_id": product.product_id,
  };
  const rp_update = {
    $pull: {
      "cart_orders.$[orderElem].order_products": {
        product_id: product.product_id,
      },
    },
    $inc: { cart_count_product: -1 },
  };
  const rp_options = {
    arrayFilters: [{ "orderElem.order_shopId": product.product_shopId }],
    new: true,
  };
  const removeProductFromCart = await cartModel
    .findOneAndUpdate(rp_query, rp_update, rp_options)
    .select(getUnSelectData(unSelect));

  // Remove the entire order_products array if it's empty
  const ro_query = {
    cart_userId: convertToObjectIdMongoDB(userId),
    cart_state: CartStateEnum.ACTIVE,
    "cart_orders.order_shopId": convertToObjectIdMongoDB(
      product.product_shopId
    ),
    "cart_orders.order_products": { $exists: true, $eq: [] },
  };
  const ro_update = {
    $pull: {
      cart_orders: {
        order_shopId: convertToObjectIdMongoDB(product.product_shopId),
        order_products: { $exists: true, $eq: [] },
      },
    },
  };
  const ro_options = {
    new: true,
  };
  const removeEmptyOrderProducts = await cartModel
    .findOneAndUpdate(ro_query, ro_update, ro_options)
    .select(getUnSelectData(unSelect));

  if (removeEmptyOrderProducts) {
    return removeEmptyOrderProducts;
  }

  return removeProductFromCart;
};

// Delete
const deleteUserCart = async ({ userId }) => {
  try {
    const query = { cart_userId: userId };

    return await cartModel.deleteOne(query);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getCartByUserIdAndShopId,
  getCartByUserId,
  addOrCreateCartWithOrder,
  updateProductQuantityByAmount,
  updateProductQuantity,
  addProductToOrderProducts,
  deleteUserCart,
  removeProductFromUserCart,
};
