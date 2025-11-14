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
    const item = originalFunc(input);
    set(key, item);
    return item;
  };
}
