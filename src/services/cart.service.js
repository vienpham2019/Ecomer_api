"use strict";

const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require("../core/error.response");
const {
  addOrCreateCartWithOrder,
  getCartByUserIdAndShopId,
  addProductToOrderProducts,
  deleteUserCart,
  removeProductFromUserCart,
  getCartByUserId,
  updateProductQuantity,
  updateProductQuantityByAmount,
} = require("../models/cart/cart.repo");
const { findProduct } = require("../models/product/product.repo");

/*
    - Add product to Cart [User]
    - Reduce product quantity by one [User]
    - Increase product quantity by one [User]
    - Get cart lists [User]
    - Delete cart [User]
    - Delete cart item [User]
*/

class CartService {
  // Get
  static async getUserCart({ userId }) {
    return await this._getCartByUserId({ userId });
  }
  // Create
  static async addToCart({ userId, product }) {
    // check for
    const foundProduct = await this._validateProduct({
      productId: product._id,
    });

    const {
      product_shopId,
      product_name,
      product_price,
      _id,
      product_discountPrice = 0,
    } = foundProduct;

    let addToCartProduct = {
      product_id: _id,
      product_shopId,
      product_price,
      product_name,
      product_discountPrice,
    };

    // Check if the user has a cart with matching product_shopId
    const existingCart = await getCartByUserIdAndShopId({
      userId,
      shopId: addToCartProduct.product_shopId,
    });
    if (!existingCart) {
      await addOrCreateCartWithOrder({
        userId,
        shopId: addToCartProduct.product_shopId,
      });
    }

    // if cart exist then update product quantity
    return await addProductToOrderProducts({
      userId,
      product: addToCartProduct,
    });
  }
  // Update
  static async removeProductFromUserCart({ userId, productId }) {
    const { foundProduct, foundProductInCart } = await this._getProductInCart({
      userId,
      productId,
    });
    const removeProduct = await removeProductFromUserCart({
      userId,
      product: {
        ...foundProductInCart._doc,
        product_shopId: foundProduct.product_shopId,
      },
    });

    if (removeProduct.modifiedCount === 0) {
      throw new NotFoundError(`Product not in cart`);
    }
    return removeProduct;
  }

  static async updateProductQuantity({ userId, productId, quantity }) {
    if (quantity <= 0) {
      return await this.removeProductFromUserCart({ userId, productId });
    }

    const { foundCart, foundProduct, foundProductInCart } =
      await this._getProductInCart({ userId, productId });

    if (quantity === foundProductInCart.product_quantity) {
      return foundCart;
    }

    const updateProduct = await updateProductQuantityByAmount({
      userId,
      product: {
        ...foundProductInCart._doc,
        product_shopId: foundProduct.product_shopId,
      },
      quantityAmount: quantity - foundProductInCart.product_quantity,
    });

    if (updateProduct.modifiedCount === 0) {
      throw new NotFoundError(`Can't update product quantity`);
    }
    return updateProduct;
  }

  // Delete
  static async deleteUserCart({ userId }) {
    await this._getCartByUserId({ userId });
    return await this._deleteUserCart({ userId });
  }

  // Helper method
  // get
  static async _getCartByUserId({ userId }) {
    const foundCart = await getCartByUserId({ userId });
    if (!foundCart) {
      throw new NotFoundError(`Cart not found`);
    }
    return foundCart;
  }

  static async _getProductInCart({ userId, productId }) {
    const foundCart = await this._validateCartOrders({ userId });
    const foundProduct = await this._validateProduct({ productId });
    const foundOrders = foundCart.cart_orders.find(
      (order) =>
        order.order_shopId.toString() === foundProduct.product_shopId.toString()
    );
    if (!foundOrders) {
      throw new NotFoundError(`Product not found`);
    }

    const foundProductInCart = foundOrders.order_products.find(
      (product) => product.product_id.toString() === productId.toString()
    );
    if (!foundProductInCart) {
      throw new NotFoundError(`Product not found`);
    }
    return { foundProductInCart, foundCart, foundProduct };
  }

  static async _validateCartOrders({ userId }) {
    const foundCart = await this._getCartByUserId({ userId });
    if (foundCart?.cart_orders.length === 0) {
      throw new NotFoundError(`Cart empty!`);
    }
    return foundCart;
  }

  static async _validateProduct({ productId }) {
    const foundProduct = await findProduct({
      productId,
      unSelect: [],
    });
    if (!foundProduct) {
      throw new NotFoundError(`Product not found`);
    }
    return foundProduct;
  }

  // delete
  static async _deleteUserCart({ userId }) {
    const deleteCart = await deleteUserCart({ userId });
    if (!deleteCart.deletedCount === 0) {
      throw new ForbiddenError(`Can't delete user cart`);
    }
    return deleteCart;
  }
}

module.exports = CartService;
