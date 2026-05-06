import { createClient, type RedisClientType } from "redis";
import { env } from "@/config/env.js";
import { logger } from "@/services/logger.js";

type CacheEnvelope<T> = { value: T };
type InMemoryEntry = { value: unknown; expiresAt: number };

const inMemory = new Map<string, InMemoryEntry>();
let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType | null> | null = null;

const buildKey = (key: string) => `${env.REDIS_KEY_PREFIX}:${key}`;

export const getRedisClient = async (): Promise<RedisClientType | null> => {
  if (!env.REDIS_URL) return null;
  if (client?.isOpen) return client;

  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const c = createClient({ url: env.REDIS_URL }) as RedisClientType;
        c.on("error", (err) => logger.error({ err }, "redis client error"));
        await c.connect();
        client = c;
        return c;
      } catch (err) {
        logger.error({ err }, "failed to connect to redis");
        client = null;
        connectPromise = null;
        return null;
      }
    })();
  }
  return connectPromise;
};

const getInMemory = <T>(key: string): { found: true; value: T } | { found: false } => {
  const entry = inMemory.get(key);
  if (!entry) return { found: false };
  if (entry.expiresAt <= Date.now()) {
    inMemory.delete(key);
    return { found: false };
  }
  return { found: true, value: entry.value as T };
};

const setInMemory = <T>(key: string, value: T, ttlSeconds: number) => {
  const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1_000 : Number.POSITIVE_INFINITY;
  inMemory.set(key, { value, expiresAt });
};

export async function getRedisJson<T>(
  key: string,
  ttlSeconds: number,
): Promise<{ found: true; value: T } | { found: false }> {
  const localKey = buildKey(key);
  const local = getInMemory<T>(localKey);
  if (local.found) return local;

  const c = await getRedisClient();
  if (!c) return { found: false };

  try {
    const payload = await c.get(localKey);
    if (!payload) return { found: false };
    const parsed = JSON.parse(payload) as CacheEnvelope<T>;
    setInMemory(localKey, parsed.value, ttlSeconds);
    return { found: true, value: parsed.value };
  } catch (err) {
    logger.error({ err, key }, "redis read failed");
    return { found: false };
  }
}

export async function setRedisJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const localKey = buildKey(key);
  setInMemory(localKey, value, ttlSeconds);

  const c = await getRedisClient();
  if (!c) return;

  try {
    const payload = JSON.stringify({ value } as CacheEnvelope<T>);
    if (ttlSeconds > 0) await c.set(localKey, payload, { EX: ttlSeconds });
    else await c.set(localKey, payload);
  } catch (err) {
    logger.error({ err, key }, "redis write failed");
  }
}

export async function withRedisCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await getRedisJson<T>(key, ttlSeconds);
  if (cached.found) return cached.value;
  const value = await loader();
  await setRedisJson(key, value, ttlSeconds);
  return value;
}
