const { getCache, setCache, deleteCache } = require('../config/redis');

/**
 * Generate cache key for district current month
 */
const getDistrictCurrentKey = (state, district) => {
  return `district:${state}:${district}:current`;
};

/**
 * Generate cache key for district history
 */
const getDistrictHistoryKey = (state, district, months) => {
  return `district:${state}:${district}:history:${months}`;
};

/**
 * Generate cache key for state comparison
 */
const getStateCompareKey = (state, district) => {
  return `state:${state}:compare:${district}`;
};

/**
 * Generate cache key for search results
 */
const getSearchKey = (query) => {
  return `search:${query.toLowerCase().trim()}`;
};

/**
 * Cache wrapper for district current month endpoint
 */
const cacheDistrictCurrent = async (state, district, data, ttl = 1800) => {
  const key = getDistrictCurrentKey(state, district);
  await setCache(key, { ...data, source: 'cache', cached_at: new Date().toISOString() }, ttl);
};

const getCachedDistrictCurrent = async (state, district) => {
  const key = getDistrictCurrentKey(state, district);
  return await getCache(key);
};

/**
 * Cache wrapper for district history endpoint
 */
const cacheDistrictHistory = async (state, district, months, data, ttl = 3600) => {
  const key = getDistrictHistoryKey(state, district, months);
  await setCache(key, { ...data, source: 'cache', cached_at: new Date().toISOString() }, ttl);
};

const getCachedDistrictHistory = async (state, district, months) => {
  const key = getDistrictHistoryKey(state, district, months);
  return await getCache(key);
};

/**
 * Cache wrapper for state comparison endpoint
 */
const cacheStateCompare = async (state, district, data, ttl = 3600) => {
  const key = getStateCompareKey(state, district);
  await setCache(key, { ...data, source: 'cache', cached_at: new Date().toISOString() }, ttl);
};

const getCachedStateCompare = async (state, district) => {
  const key = getStateCompareKey(state, district);
  return await getCache(key);
};

/**
 * Invalidate cache for a district (when new data is loaded)
 */
const invalidateDistrictCache = async (state, district) => {
  const keys = [
    getDistrictCurrentKey(state, district),
    getStateCompareKey(state, district),
  ];
  // Note: History cache keys have months parameter, so we can't easily invalidate all
  // In production, consider using Redis keys pattern matching
  for (const key of keys) {
    await deleteCache(key);
  }
};

module.exports = {
  cacheDistrictCurrent,
  getCachedDistrictCurrent,
  cacheDistrictHistory,
  getCachedDistrictHistory,
  cacheStateCompare,
  getCachedStateCompare,
  invalidateDistrictCache,
};

