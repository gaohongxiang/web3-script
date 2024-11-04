// 全局缓存对象
const cache = {
  addresses: new Map(),  // 缓存解密后的地址信息
  transactions: new Map(),  // 缓存交易信息
  utxos: new Map()  // 缓存 UTXO 列表
};

export function getCacheKey(type, ...args) {
  return `${type}:${args.join(':')}`;
}

export function getCache(type, key) {
  const cacheMap = cache[type];
  return cacheMap?.get(key);
}

export function setCache(type, key, value) {
  const cacheMap = cache[type];
  if (cacheMap) {
    cacheMap.set(key, value);
  }
}

export function clearCache(type) {
  const cacheMap = cache[type];
  if (cacheMap) {
    cacheMap.clear();
  }
}

export function clearAllCache() {
  Object.values(cache).forEach(map => map.clear());
} 