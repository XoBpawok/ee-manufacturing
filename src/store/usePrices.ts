import { useCallback, useEffect, useState } from "react";
import { message } from "antd";
import { fetchPrices, upsertPrice, type PriceEntry } from "../api/prices";

export interface PricesState {
  priceOverrides: Map<number, number>;
  priceMeta: Map<number, PriceEntry>;
  pricesLoading: boolean;
  setPriceOverride: (itemId: number, price: number) => void;
}

export function usePrices(): PricesState {
  const [priceMeta, setPriceMeta] = useState<Map<number, PriceEntry>>(new Map());
  const [pricesLoading, setPricesLoading] = useState(true);

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
    };
  }, []);

  const setPriceOverride = useCallback((itemId: number, price: number) => {
    // оптимістичне оновлення
    const optimistic: PriceEntry = { price, updatedAt: new Date().toISOString() };
    setPriceMeta((prev) => new Map(prev).set(itemId, optimistic));
    upsertPrice(itemId, price)
      .then((entry) => setPriceMeta((prev) => new Map(prev).set(itemId, entry)))
      .catch(() => {
        void message.warning("Не вдалося зберегти ціну в базі — лишилась локально");
      });
  }, []);

  const priceOverrides = new Map<number, number>();
  for (const [id, e] of priceMeta) priceOverrides.set(id, e.price);

  return { priceOverrides, priceMeta, pricesLoading, setPriceOverride };
}
