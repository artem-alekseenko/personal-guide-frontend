import { beforeEach, vi } from "vitest";
import { computed, ref, readonly, watch, watchEffect, shallowRef } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { createError, defineEventHandler, readBody, getQuery } from "h3";
const state = new Map();
const storage = new Map();
const localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};
Object.assign(globalThis, {
  computed,
  ref,
  readonly,
  watch,
  watchEffect,
  shallowRef,
  createError,
  defineEventHandler,
  readBody,
  getQuery,
  localStorage,
  window: { localStorage },
  useState: (key: string, init: () => unknown) => {
    if (!state.has(key)) state.set(key, ref(init()));
    return state.get(key);
  },
  useLocalStorage: (key: string, initial: unknown) => {
    if (!state.has(key)) state.set(key, ref(initial));
    return state.get(key);
  },
});
beforeEach(() => {
  state.clear();
  storage.clear();
  setActivePinia(createPinia());
  vi.clearAllMocks();
});
