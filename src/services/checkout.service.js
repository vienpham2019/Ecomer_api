"use strict";

const { BadRequestError } = require("../core/error.response");
const {
  applyOrderCoupon,
  cancelCouponCode,
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
    const foundDiscount = await DiscountService.canApplyCouponCode({
      userId,
      code,
      products: orders.order_products,
    });

    await DiscountService.applyDiscountCode({
      discount: foundDiscount,
      userId,
    });

    const order_coupon = {
      coupon_type: foundDiscount.discount_type,
      coupon_value: foundDiscount.discount_value,
      coupon_code: code,
    };
    return await applyOrderCoupon({ userId, shopId, payload: order_coupon });
  }

  static async cancelCouponCode({ userId, shopId, code }) {
    await DiscountService.cancelCouponCode({ code, userId });
    return await cancelCouponCode({ userId, shopId });
  }

  // Helper
  static filterCartOrdersByProductIds = ({ cart, productIds }) => {
    const filteredOrders = cart.car_orders.filter((order) => {
      return order.order_products.some((product) =>
        productIds.includes(product.product_id)
      );
    });

    return {
      ...cart,
      cart_orders: filteredOrders,
    };
  };
}

module.exports = CheckoutService;
