import { LRUCache } from "lru-cache";

const cache = new LRUCache({
  max: 10000,
  ttl: 1000 * 60 * 60 * 24,
});

export async function get<T = unknown>(key: string) {
  return cache.get(key) as T | undefined;
}

export async function set(key: string, value: unknown) {
  cache.set(key, value as {});
}

export function del(key: string) {
  cache.delete(key);
}

export function wrapWithCache<Input = unknown, Output = unknown>(
  originalFunc: (input: Input) => Promise<Output>,
  getKey: (input: Input) => string
) {
  return async function (input: Input) {
    const key = getKey(input);
    const cachedItem = await get<Output>(key);
    if (cachedItem) {
      return cachedItem;
    }

    // Cache the in-flight promise so concurrent callers for the same key share
    // one upstream fetch instead of each racing the relays.
    const item = originalFunc(input);
    set(key, item);
    try {
      return await item;
    } catch (e) {
      // Don't let a transient relay error stick for the whole TTL.
      del(key);
      throw e;
    }
  };
}
