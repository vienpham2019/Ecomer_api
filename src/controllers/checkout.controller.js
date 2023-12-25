"use strict";

const { SuccessResponse } = require("../core/success.response");
const CheckoutService = require("../services/checkout.service");

class CheckoutController {
  applyCouponCode = async (req, res, next) => {
    new SuccessResponse({
      message: "Apply discount code Success!",
      metadata: await CheckoutService.applyCoupon({
        ...req.body,
        userId: req.user.userId,
      }),
    }).send(res);
  };

  cancelCouponCode = async (req, res, next) => {
    new SuccessResponse({
      message: "Cancel discount code Success!",
      metadata: await CheckoutService.cancelCouponCode({
        ...req.body,
        userId: req.user.userId,
      }),
    }).send(res);
  };
}

module.exports = new CheckoutController();
