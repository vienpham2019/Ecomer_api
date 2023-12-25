"use strict";

const { mongoose } = require("mongoose");
const { BadRequestError, NotFoundError } = require("../../core/error.response");
const {
  findAllDraftsForShop,
  findAllPublishsForShop,
  publishProductByShop,
  unPublishProductByShop,
  searchProductByUser,
  findAllProducts,
  findProduct,
  getProductType,
  findProductByShopId,
  appyProductDiscount,
} = require("../../models/product/product.repo");
const {
  ProductTypeEnum,
  ProductDiscountTypeEnum,
} = require("../../models/product/product.enum");

// define Factory class to create product
class ProductFactory {
  static productRegistry = {}; // key - class

  static registerProductType(type, classRef) {
    ProductFactory.productRegistry[type] = classRef;
  }

  // Create
  static async createProduct({ type, payload }) {
    const productClass = ProductFactory.productRegistry[type];
    if (!productClass) {
      throw new BadRequestError(`Invalid Product Type ${type}`);
    }
    return productClass.createProduct(payload);
  }

  // Update//
  static async updateProduct({ productId, shopId, payload }) {
    const type = await getProductType({ productId });
    if (!mongoose.isValidObjectId(productId)) {
      throw new BadRequestError("Invalid product Id");
    }
    const productClass = ProductFactory.productRegistry[type];
    if (!productClass) {
      throw new BadRequestError(`Invalid Product Type ${type}`);
    }
    const unSelect = ["product_shopId", "createdAt", "updatedAt", "__v", "_id"];
    return productClass.updateProduct({
      productId,
      shopId,
      unSelect,
      payload,
    });
  }

  static async applyProductDiscount({ productId, shopId, payload }) {
    payload.product_discountValue = Math.abs(payload.product_discountValue);
    const { product_discountType, product_discountValue } = payload;
    const foundProduct = await this._foundProduct({ productId, shopId });
    payload.product_discountPrice = foundProduct.product_price;
    if (
      !Object.values(ProductDiscountTypeEnum).includes(product_discountType)
    ) {
      throw new BadRequestError(`Invalid product discount type`);
    }
    if (product_discountType === ProductDiscountTypeEnum.PERCENTAGE) {
      if (product_discountValue > 100) {
        throw new BadRequestError(
          `Can't apply ${product_discountValue}% discount`
        );
      }
      payload.product_discountPrice *= (100 - product_discountValue) / 100;
    } else {
      if (product_discountValue > foundProduct.product_price) {
        throw new BadRequestError(
          `Can't apply discount price larger than current product price`
        );
      }
      payload.product_discountPrice -= product_discountValue;
    }

    const unSelect = ["createdAt", "updatedAt", "__v", "_id"];
    return await appyProductDiscount({
      productId,
      shopId,
      unSelect,
      payload,
      isNew: true,
    });
  }

  static async publishProductByShop({ productId, shopId }) {
    const unSelect = ["createdAt", "updatedAt", "__v", "_id"];
    return await publishProductByShop({ productId, shopId, unSelect });
  }
  static async unPublishProductByShop({ productId, shopId }) {
    const unSelect = ["createdAt", "updatedAt", "__v", "_id"];
    return await unPublishProductByShop({ productId, shopId, unSelect });
  }

  // Get //
  static async findAllDraftsForShop({ shopId, limit = 50, page = 1 }) {
    return await findAllDraftsForShop({ shopId, limit, page });
  }

  static async findAllPublishsForShop({ shopId, limit = 50, page = 1 }) {
    return await findAllPublishsForShop({ shopId, limit, page });
  }

  static async searchProductByUser({
    keySearch,
    limit = 50,
    page = 1,
    sort = "ctime",
  }) {
    const select = ["product_name", "product_price", "product_thumbnail"];
    return await searchProductByUser({ keySearch, select, limit, page, sort });
  }

  static async findAllProducts({
    limit = 50,
    sort = "ctime",
    page = 1,
    filter = {},
  }) {
    const select = ["product_name", "product_price", "product_thumbnail"];
    return await findAllProducts({
      sort,
      page,
      filter,
      limit,
      select,
    });
  }

  static async findProduct({ productId }) {
    if (!mongoose.isValidObjectId(productId)) {
      throw new BadRequestError("Invalid product Id");
    }
    const unSelect = ["__v"];
    return await findProduct({ productId, unSelect });
  }

  // Delete
  static async deleteDraftProduct({ productId, shopId }) {
    const type = await getProductType({ productId });
    const productClass = ProductFactory.productRegistry[type];
    return await productClass.deleteDraftProduct({ productId, shopId });
  }

  // Helper
  static async _foundProduct({ productId, shopId }) {
    const foundProduct = await findProductByShopId({ shopId, productId });
    if (!foundProduct) {
      throw new NotFoundError(`Product not found`);
    }
    return foundProduct;
  }
}

// register product type
ProductFactory.registerProductType(
  ProductTypeEnum.ELECTRONIC,
  require("./class/Electronic")
);
ProductFactory.registerProductType(
  ProductTypeEnum.CLOTHING,
  require("./class/Clothing")
);
ProductFactory.registerProductType(
  ProductTypeEnum.FURNITURE,
  require("./class/Furniture")
);

module.exports = ProductFactory;
