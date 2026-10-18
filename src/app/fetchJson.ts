import { type Ref, ref } from "vue";

export interface JsonData<T> {
  data: Ref<T>;
  loading: Ref<boolean>;
  failed: Ref<boolean>;
  /** Settles once the file is in or has failed, which hydration waits for. */
  ready: Promise<void>;
}

/** Kept for the life of the page, so switching back to a page redraws at once instead of loading again. */
const loaded = new Map<string, JsonData<unknown>>();

/** A generated file by its path under the site root; `empty` stands in until it arrives. */
export function useJson<T>(file: string, empty: T): JsonData<T> {
  const cached = loaded.get(file);
  if (cached) return cached as JsonData<T>;
  const state = { data: ref(empty) as Ref<T>, loading: ref(true), failed: ref(false) };
  const data: JsonData<T> = { ...state, ready: load(file, state) };
  loaded.set(file, data);
  return data;
}

/** Server only: the file's contents up front, since the prerender has no host to fetch from. */
export function seedJson(file: string, value: unknown): void {
  loaded.set(file, {
    data: ref(value),
    loading: ref(false),
    failed: ref(false),
    ready: Promise.resolve(),
  });
}

async function load<T>(file: string, data: Omit<JsonData<T>, "ready">): Promise<void> {
  try {
    // Same url as the preload links in the two index.html files, so this reuses that response.
    const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data.data.value = (await res.json()) as T;
  } catch {
    data.failed.value = true;
    // Not cached as failed, so the next mount tries again.
    loaded.delete(file);
  } finally {
    data.loading.value = false;
  }
}
