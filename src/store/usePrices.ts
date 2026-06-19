import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "antd";
import { fetchPrices, upsertPrice, type PriceEntry } from "../api/prices";

export interface PricesState {
  priceOverrides: Map<number, number>;
  priceMeta: Map<number, PriceEntry>;
  pricesLoading: boolean;
  setPriceOverride: (itemId: number, price: number) => void;
}

const UPSERT_DEBOUNCE_MS = 500;

// Several independent usePrices() instances are expected to exist at once (the calculator
// page and the rating page) — the `prices` table in Supabase is the shared source of truth;
// each instance loads data on mount, so state is synced through the server, not directly between instances.
export function usePrices(): PricesState {
  const [priceMeta, setPriceMeta] = useState<Map<number, PriceEntry>>(new Map());
  const [pricesLoading, setPricesLoading] = useState(true);
  const pendingTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let active = true;
    fetchPrices()
      .then((map) => {
        if (active) setPriceMeta(map);
      })
      .finally(() => {
        if (active) setPricesLoading(false);
      });
    return () => {
      active = false;
      for (const timer of pendingTimers.current.values()) clearTimeout(timer);
      pendingTimers.current.clear();
    };
  }, []);

  const setPriceOverride = useCallback((itemId: number, price: number) => {
    // optimistic update — immediate, synchronous
    const optimistic: PriceEntry = { price, updatedAt: new Date().toISOString() };
    setPriceMeta((prev) => new Map(prev).set(itemId, optimistic));

    // debounce the network write to Supabase: InputNumber.onChange fires on every typed
    // character, and the prices table is shared, so we write at most once per ~500ms per itemId
    const existing = pendingTimers.current.get(itemId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      pendingTimers.current.delete(itemId);
      upsertPrice(itemId, price)
        .then((entry) => {
          setPriceMeta((prev) => {
            const current = prev.get(itemId);
            // guard against a late response: do not overwrite newer local state with older
            if (current && entry.updatedAt < current.updatedAt) return prev;
            return new Map(prev).set(itemId, entry);
          });
        })
        .catch(() => {
          void message.warning("Не вдалося зберегти ціну в базі");
        });
    }, UPSERT_DEBOUNCE_MS);
    pendingTimers.current.set(itemId, timer);
  }, []);

  const priceOverrides = new Map<number, number>();
  for (const [id, e] of priceMeta) priceOverrides.set(id, e.price);

  return { priceOverrides, priceMeta, pricesLoading, setPriceOverride };
}
