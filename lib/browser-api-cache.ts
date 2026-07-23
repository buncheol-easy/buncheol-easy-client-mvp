type BrowserCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const browserApiCachePrefix = "buncheol-api-cache:";
const memoryCache = new Map<string, BrowserCacheEntry<unknown>>();

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getCacheKey(key: string) {
  return `${browserApiCachePrefix}${key}`;
}

export function readBrowserApiCache<T>(key: string): T | null {
  const cacheKey = getCacheKey(key);
  const now = Date.now();
  const memoryEntry = memoryCache.get(cacheKey);

  if (memoryEntry) {
    if (memoryEntry.expiresAt > now) {
      return memoryEntry.value as T;
    }

    memoryCache.delete(cacheKey);
  }

  const storage = getStorage();

  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(cacheKey);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as BrowserCacheEntry<T>;

    if (!parsed || parsed.expiresAt <= now) {
      storage.removeItem(cacheKey);
      return null;
    }

    memoryCache.set(cacheKey, parsed);
    return parsed.value;
  } catch {
    storage.removeItem(cacheKey);
    return null;
  }
}

export function writeBrowserApiCache<T>(
  key: string,
  value: T,
  ttlMs: number,
) {
  const cacheKey = getCacheKey(key);
  const entry: BrowserCacheEntry<T> = {
    expiresAt: Date.now() + ttlMs,
    value,
  };

  memoryCache.set(cacheKey, entry);

  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // Cache writes are best-effort.
  }
}

export function clearBrowserApiCacheByPrefix(prefix: string) {
  const fullPrefix = getCacheKey(prefix);

  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(fullPrefix)) {
      memoryCache.delete(key);
    }
  }

  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);

      if (key?.startsWith(fullPrefix)) {
        storage.removeItem(key);
      }
    }
  } catch {
    // Cache cleanup is best-effort.
  }
}
