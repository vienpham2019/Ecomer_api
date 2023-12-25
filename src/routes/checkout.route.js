"use strict";

const express = require("express");
const { asyncHandler } = require("../helpers/asyncHandler");
const { authentication } = require("../auth/authUtil");
const {
  applyCouponCode,
  cancelCouponCode,
} = require("../controllers/checkout.controller");

const router = express.Router();

// Authentication
router.use(authentication);

router.patch("/applyCoupon", asyncHandler(applyCouponCode));
router.patch("/cancelCoupon", asyncHandler(cancelCouponCode));

module.exports = router;
