"use strict";

const { BadRequestError } = require("../core/error.response");
const {
  applyOrderCouponToCart,
  cancelCouponCodeFromCart,
} = require("../models/cart/cart.repo");
const { findProductByShopId } = require("../models/product/product.repo");
const CartService = require("./cart.service");
const DiscountService = require("./discount.service");

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
    for (let order of foundCart.cart_orders) {
      for (let product of order.order_products) {
        let foundProduct = await findProductByShopId({
          shopId: order.order_shopId,
          productId: product.product_id,
        });
        if (foundProduct.product_price != product.price) {
          throw new BadRequestError(
            `Product has update price please go back to Cart to confirm.`
          );
        }
      }
    }
  }
}

module.exports = CheckoutService;
