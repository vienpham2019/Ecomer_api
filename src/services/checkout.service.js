"use strict";

const { BadRequestError } = require("../core/error.response");
const {
  applyOrderCouponToCart,
  cancelCouponCodeFromCart,
} = require("../models/cart/cart.repo");
const { findProductByShopId } = require("../models/product/product.repo");
const CartService = require("./cart.service");
const DiscountService = require("./discount.service");
const { acquireLock, releaseLock } = require("./redis.service");

class CheckoutService {
  static async applyCoupon({ userId, shopId, code }) {
    const foundCart = await CartService._validateCartOrders({ userId });
    const orders = foundCart.cart_orders.find(
      (order) => order.order_shopId.toString() === shopId.toString()
    );
    if (!orders) {
      throw new BadRequestError();
    }
    if (orders?.order_coupon?.coupon_code === code) {
      return {};
    }
    const { foundDiscount, discountApplyAmount } =
      await DiscountService.canApplyCouponCode({
        userId,
        code,
        products: orders.order_products,
      });

    if (orders?.order_coupon?.coupon_code) {
      await DiscountService.cancelCouponCode({
        code: orders.order_coupon.coupon_code,
        userId,
      });
      await cancelCouponCodeFromCart({
        userId,
        shopId,
        discountApplyAmount: orders.order_coupon.coupon_applyAmount,
      });
    }

    await DiscountService.applyDiscountCode({
      discount: foundDiscount,
      userId,
    });

    const order_coupon = {
      coupon_type: foundDiscount.discount_type,
      coupon_value: foundDiscount.discount_value,
      coupon_code: code,
      coupon_applyAmount: discountApplyAmount,
    };
    return await applyOrderCouponToCart({
      userId,
      shopId,
      payload: order_coupon,
      discountApplyAmount,
    });
  }

  static async cancelCouponCode({ userId, shopId, code }) {
    const foundCart = await CartService._validateCartOrders({ userId });
    const orders = foundCart.cart_orders.find(
      (order) => order.order_shopId.toString() === shopId.toString()
    );

    if (orders?.order_coupon?.coupon_code != code) {
      throw new BadRequestError();
    }
    const discountApplyAmount = orders.order_coupon.coupon_applyAmount;
    await DiscountService.cancelCouponCode({ code, userId });
    return await cancelCouponCodeFromCart({
      userId,
      shopId,
      discountApplyAmount,
    });
  }

  static async orderByUser({ userId }) {
    const foundCart = await CartService._validateCartOrders({ userId });
    if (foundCart?.cart_orders.length === 0) {
      throw new BadRequestError(`No order`);
    }
    let isCheckOutProductFails = false;
    const checkOutProductComplete = [];
    for (let order of foundCart.cart_orders) {
      for (let product of order.order_products) {
        let foundProduct = await findProductByShopId({
          shopId: order.order_shopId,
          productId: product.product_id,
        });
        const { product_price, product_id, product_quantity } = foundProduct;
        if (product_price != product.price) {
          throw new BadRequestError(
            `Product has update please go back to Cart to confirm.`
          );
        }
        const keyLock = await acquireLock(
          product_id,
          product_quantity,
          foundCart._id
        );
        if (keyLock) {
          checkOutProductComplete.push(product_id);
          await releaseLock(keyLock);
        } else {
          isCheckOutProductFails = true;
        }
      }
    }

    // Create new order

    if (isCheckOutProductFails) {
      throw new BadRequestError(
        "Some products have been updated. Please return to your cart to confirm."
      );
    }
  }
}

module.exports = CheckoutService;
