"use strict";

const { BadRequestError } = require("../core/error.response");
const {
  applyOrderCouponToCart,
  cancelCouponCodeFromCart,
} = require("../models/cart/cart.repo");
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
}

module.exports = CheckoutService;
