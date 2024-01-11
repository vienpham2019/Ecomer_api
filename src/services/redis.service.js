"use strict";

const redis = require("redis");
const { promisify } = require("util");
const { reservationInventory } = require("../models/inventory/inventory.repo");
const InventoryService = require("./inventory.service");
const redisClient = redis.createClient();

const pexpire = promisify(redisClient.PEXPIRE).bind(redisClient);
const setnxAsync = promisify(redisClient.SETNX).bind(redisClient);

const acquireLock = async (productId, quantity, cartId) => {
  const key = `lock_v2024_${productId}`;
  const retryTimes = 10;
  const expireTime = 3000; // 3 second time lock

  for (let i = 0; i < retryTimes; i++) {
    const result = await setnxAsync(key, expireTime);
    if (result === 1) {
      const isReversation = await InventoryService.reservationInventory({
        productId,
        quantity,
        cartId,
      });
      if (isReversation.modifiedCount) {
        await pexpire(key, expireTime);
        return key;
      }
      return null;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
};

const releaseLock = async (keyLock) => {
  const delAsyncKey = promisify(redisClient.DEL).bind(redisClient);
  return await delAsyncKey(keyLock);
};

module.exports = {
  acquireLock,
  releaseLock,
};
