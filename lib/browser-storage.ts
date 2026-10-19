export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function browserStorage(kind: "localStorage" | "sessionStorage"): KeyValueStorage | null {
  try {
    const value = (globalThis as unknown as Record<string, unknown>)[kind];
    if (!value || typeof value !== "object") return null;
    const storage = value as Partial<KeyValueStorage>;
    if (typeof storage.getItem !== "function" || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") return null;
    return storage as KeyValueStorage;
  } catch {
    return null;
  }
}

export function safeStorageGet(storage: KeyValueStorage | null, key: string) {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(storage: KeyValueStorage | null, key: string, value: string) {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeStorageRemove(storage: KeyValueStorage | null, key: string) {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function localStore() {
  return browserStorage("localStorage");
}

export function sessionStore() {
  return browserStorage("sessionStorage");
}
