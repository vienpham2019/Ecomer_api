const DiscountTypeEnum = Object.freeze({
  FIXED: "fixed",
  PERCENTAGE: "percentage",
  // Add more roles as needed
});

const DiscountAppliesToEnum = Object.freeze({
  ALL: "all",
  SPECIFIC: "specific",
});

module.exports = { DiscountTypeEnum, DiscountAppliesToEnum };
