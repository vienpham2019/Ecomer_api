const ProductTypeEnum = Object.freeze({
  ELECTRONIC: "Electronic",
  CLOTHING: "Clothing",
  FURNITURE: "Furniture",
  // Add more roles as needed
});

const ProductDiscountTypeEnum = Object.freeze({
  FIXED: "fixed",
  PERCENTAGE: "percentage",
  // Add more roles as needed
});

module.exports = { ProductTypeEnum, ProductDiscountTypeEnum };
