// FILE: redisCache.js
// ROLE: Redis-backed cache with in-memory fallback
// INSPIRED BY: Low-latency fraud score caching
// PERFORMANCE TARGET: Cache operations under 2ms
const Redis = require("ioredis");

class RedisCache {
  constructor() {
    this.memory = new Map();
    this.redis = null;
    this.redisAvailable = false;
    this.reconnecting = false;
    this.forcedUnavailableUntil = 0;
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          retryStrategy: () => null,
        });
        this.redis.on("error", () => {
          this.redisAvailable = false;
        });
        this.redis.on("close", () => {
          this.redisAvailable = false;
        });
        this.tryReconnect();
      } catch (_error) {
        this.redis = null;
        this.redisAvailable = false;
      }
    }
  }

  isForcedUnavailable() {
    return Date.now() < this.forcedUnavailableUntil;
  }

  async tryReconnect() {
    if (!this.redis || this.reconnecting || this.isForcedUnavailable()) return;
    this.reconnecting = true;
    try {
      if (this.redis.status !== "ready") {
        await this.redis.connect();
      }
      this.redisAvailable = true;
    } catch (_error) {
      this.redisAvailable = false;
    } finally {
      this.reconnecting = false;
    }
  }

  status() {
    return {
      redisAvailable: this.redisAvailable && !this.isForcedUnavailable(),
      mode: this.redisAvailable && !this.isForcedUnavailable() ? "redis" : "memory_fallback",
      forcedUnavailable: this.isForcedUnavailable(),
    };
  }

  degrade(durationMs = 20000) {
    this.forcedUnavailableUntil = Date.now() + durationMs;
    this.redisAvailable = false;
  }

  async get(key) {
    if (this.redis && !this.redisAvailable) {
      this.tryReconnect();
    }
    if (this.redis && this.redisAvailable && !this.isForcedUnavailable()) {
      try {
        const value = await this.redis.get(key);
        if (value) return JSON.parse(value);
      } catch (_error) {
        this.redisAvailable = false;
      }
    }
    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.value;
  }

  async set(key, value, ttlSeconds = 60) {
    if (this.redis && !this.redisAvailable) {
      this.tryReconnect();
    }
    if (this.redis && this.redisAvailable && !this.isForcedUnavailable()) {
      try {
        await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
        return;
      } catch (_error) {
        this.redisAvailable = false;
      }
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key) {
    if (this.redis && !this.redisAvailable) {
      this.tryReconnect();
    }
    if (this.redis && this.redisAvailable && !this.isForcedUnavailable()) {
      try {
        await this.redis.del(key);
      } catch (_error) {
        this.redisAvailable = false;
      }
    }
    this.memory.delete(key);
  }
}

module.exports = new RedisCache();
