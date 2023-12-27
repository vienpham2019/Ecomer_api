"use strict";

const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require("../core/error.response");
const {
  DiscountAppliesToEnum,
  DiscountTypeEnum,
} = require("../models/discount/discount.enum");
const {
  findDiscount,
  createDiscount,
  findAllDiscountCodesUnSelect,
  findAllDiscountCodesSelect,
  cancelDiscountForUser,
  applyDiscountForUser,
  addDiscountUsersUsed,
  updateDiscount,
  deleteDiscountCode,
} = require("../models/discount/discount.repo");
const {
  findAllProducts,
  findProductByShopId,
  checkForValidProductIds,
} = require("../models/product/product.repo");

const {
  convertToObjectIdMongoDB,
  removeUndefinedNull,
  isInValidDate,
  removeDuplicatesInArray,
} = require("../utils");

/*
    Discount Services 
    - Generator Discount Code [Shop | Admin]
    - Get discount amount [User]
    - Get all discount codes [User | Shop]
    - Verify discount code [User]
    - Delete discount code [Admin | Shop]
    - Cancel discoount code [User]
*/

class DiscountService {
  // Get
  static async getAllDiscountCodesWithProduct({
    code,
    shopId,
    limit = 50,
    page = 1,
    sort = "ctime",
  }) {
    const foundDiscount = await findDiscount({
      discount_code: code,
      discount_shopId: convertToObjectIdMongoDB(shopId),
    });

    if (!foundDiscount?.discountIsActive) {
      throw new BadRequestError("Discount not exists");
    }

    const { discount_appliesTo, discount_productIds } = foundDiscount;
    let products;
    if (discount_appliesTo === DiscountAppliesToEnum.ALL) {
      products = await findAllProducts({
        filter: {
          product_shop: convertToObjectIdMongoDB(shopId),
          isPublished: true,
        },
        limit,
        page,
        sort,
        select: ["product_name"],
      });
    } else if (discount_appliesTo === DiscountAppliesToEnum.SPECIFIC) {
      products = await findAllProducts({
        filter: {
          _id: { $in: discount_productIds },
          isPublished: true,
        },
        limit,
        page,
        sort,
        select: ["product_name"],
      });
    }
    return products;
  }

  static async getAllDiscountCodeByUser({
    limit = 50,
    page = 1,
    sort = "ctime",
    shopId,
  }) {
    const filter = {
      discount_shopId: convertToObjectIdMongoDB(shopId),
      discount_isActive: true,
    };
    const select = [
      "discount_name",
      "discount_description",
      "discount_code",
      "discount_startDate",
      "discount_endDate",
      "discount_type",
      "discount_value",
      "-_id",
    ];
    return await findAllDiscountCodesSelect({
      limit,
      page,
      sort,
      filter,
      select,
    });
  }

  static async getAllDiscountCodeByShop({
    limit = 50,
    page = 1,
    sort = "ctime",
    shopId,
  }) {
    const filter = {
      discount_shopId: convertToObjectIdMongoDB(shopId),
    };
    const unSelect = ["__v", "discount_shopId"];
    return await findAllDiscountCodesUnSelect({
      limit,
      page,
      sort,
      filter,
      unSelect,
    });
  }

  static async canApplyCouponCode({ code, products, userId }) {
    const foundDiscount = await findDiscount({
      discount_code: code,
    });
    if (!foundDiscount) throw new NotFoundError("Coupon code not exists!");
    const {
      discount_isActive,
      discount_maxUses,
      discount_usedCount,
      discount_startDate,
      discount_endDate,
      discount_maxUsesPerUser,
      discount_usePendingCount,
      discount_usersUsed,
      discount_minOrderValue,
      discount_productIds,
      discount_appliesTo,
      discount_shopId,
      discount_type,
      discount_value,
    } = foundDiscount;

    // Check for avaliable coupon code
    if (
      discount_maxUses &&
      discount_usedCount + discount_usePendingCount >= discount_maxUses
    ) {
      throw new BadRequestError(
        `Discount code has exceeded the max number of times can use`
      );
    }
    // check for user already use discount and base on discount_max_per_user
    const numUserUseDiscount = discount_usersUsed.filter(
      (userUsedId) => userUsedId === userId
    ).length;
    if (numUserUseDiscount >= discount_maxUsesPerUser) {
      throw new BadRequestError(
        `You has exceeded the max number of times can use this coupon code`
      );
    }

    // check for date
    if (new Date() < new Date(discount_startDate)) {
      throw new BadRequestError(
        `Coupon code start from ${discount_startDate} and end at ${discount_endDate}`
      );
    }
    if (!discount_isActive)
      throw new BadRequestError("Coupon code has expired!");
    if (discount_maxUses < 1) throw new BadRequestError("Coupon code are out!");
    if (
      new Date() < new Date(discount_startDate) ||
      new Date() > new Date(discount_endDate)
    ) {
      throw new BadRequestError("Coupon code has expired!");
    }

    let discountProductIds = [];
    // check for minimum order total for apply coupon
    let subTotal = 0;
    for (let product of products) {
      const foundProduct = await findProductByShopId({
        shopId: discount_shopId,
        productId: product.product_id,
      });
      if (foundProduct) {
        if (discount_appliesTo === DiscountAppliesToEnum.ALL) {
          discountProductIds.push(foundProduct._id);
          subTotal += product.product_quantity * foundProduct.product_price;
        } else {
          if (discount_productIds.some((id) => id.equals(product.product_id))) {
            discountProductIds.push(foundProduct._id);
            subTotal += product.product_quantity * foundProduct.product_price;
          }
        }
      }
    }

    if (subTotal < discount_minOrderValue) {
      throw new BadRequestError(
        `The minimum spend for this coupon is ${discount_minOrderValue}`
      );
    }

    let discountApplyAmount = 0;
    if (discount_type === DiscountTypeEnum.FIXED) {
      discountApplyAmount = discount_value;
    } else if (discount_type === DiscountTypeEnum.PERCENTAGE) {
      discountApplyAmount = subTotal * (discount_value / 100);
    }

    return { foundDiscount, discountApplyAmount };
  }

  // Create
  static async createDiscountCode(payload) {
    const { discount_startDate, discount_endDate, discount_code } = payload;

    payload.discount_startDate = new Date(discount_startDate);
    payload.discount_endDate = new Date(discount_endDate);

    // Check for valid date
    if (isInValidDate(payload.discount_startDate, payload.discount_endDate)) {
      throw new BadRequestError("Invalid discount dates!");
    }

    const foundDiscount = await findDiscount({
      discount_code,
    });

    if (foundDiscount) {
      throw new BadRequestError("Discount exists!");
    }

    if (payload.discount_appliesTo == DiscountAppliesToEnum.SPECIFIC) {
      payload.discount_productIds = removeDuplicatesInArray(
        payload.discount_productIds
      );
      const invalidProductIds = await checkForValidProductIds({
        payload: payload.discount_productIds,
        shopId: payload.discount_shopId,
      });
      if (invalidProductIds.length < payload.discount_productIds.length) {
        throw new BadRequestError(
          "Some of the products are not published or do not exist!"
        );
      }
    }

    return await createDiscount(payload);
  }

  // Update
  static async updateDiscountCode({ payload, discountId, shopId }) {
    const foundDiscount = await findDiscount({
      _id: discountId,
      discount_shopId: shopId,
    });

    if (!foundDiscount) {
      throw new BadRequestError(`Discount not found`);
    }

    // check if discount expire
    if (new Date(foundDiscount.discount_endDate) < new Date()) {
      throw new BadRequestError("Discount has expired. Cannot update.");
    }
    payload.discount_productIds = removeDuplicatesInArray(
      payload.discount_productIds
    );
    if (payload.discount_productIds) {
      const invalidProductIds = await checkForValidProductIds({
        payload: payload.discount_productIds,
        shopId: payload.discount_shopId,
      });
      if (invalidProductIds.length < payload.discount_productIds.length) {
        throw new BadRequestError(
          "Some of the products are not published or do not exist!"
        );
      }
    }
    payload = removeUndefinedNull(payload);

    // Check for discount start then can't update discount code
    if (payload.discount_code) {
      if (new Date(foundDiscount.discount_startDate) <= new Date()) {
        throw new BadRequestError(
          "Discount already start. Cannot update discount code"
        );
      }
      const existDiscount = await findDiscount({
        discount_code: payload.discount_code,
        discount_shopId: shopId,
      });
      if (existDiscount) {
        throw new BadRequestError("Discount exists!");
      }
    }

    // check for valid date
    let { discount_startDate, discount_endDate } = payload;
    if (discount_startDate || discount_endDate) {
      if (!discount_startDate) {
        discount_startDate = foundDiscount.discount_startDate;
      }
      if (!discount_endDate) {
        discount_endDate = foundDiscount.discount_endDate;
      }
      if (isInValidDate(discount_startDate, discount_endDate)) {
        throw new BadRequestError("Invalid discount dates!");
      }
    }
    return await updateDiscount({
      discountId,
      shopId,
      payload,
    });
  }

  static async applyDiscountCode({ discount, userId }) {
    const applyDiscount = await applyDiscountForUser({
      discountId: discount._id,
      userId,
    });

    if (!applyDiscount) {
      throw new ForbiddenError(
        `Can't get amout by discount code. Please try again!`
      );
    }
    return applyDiscount;
  }

  static async cancelCouponCode({ code, userId }) {
    const foundDiscount = await findDiscount({
      discount_code: code,
    });

    if (!foundDiscount) throw new BadRequestError("Discount doesn't existst");
    console.log(foundDiscount.discount_userUsePending);
    if (!foundDiscount.discount_userUsePending.includes(userId)) {
      throw new BadRequestError(`user not include`);
    }
    const cancelUserUsed = await cancelDiscountForUser({
      discountId: foundDiscount._id,
      userId,
    });
    if (!cancelUserUsed) {
      throw new ForbiddenError(`Can't cancle coupon code. Please try again!`);
    }
    return cancelUserUsed;
  }

  // Delete
  static async deleteDiscountCode({ shopId, code }) {
    return await deleteDiscountCode({ shopId, code });
    // write some code here
  }
}

module.exports = DiscountService;
