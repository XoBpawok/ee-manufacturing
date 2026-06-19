import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface PriceEntry {
  price: number;
  updatedAt: string;
}
export type PriceMap = Map<number, PriceEntry>;

const TABLE = "prices";

function url(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL as string | undefined;
}
function anon(): string | undefined {
  return import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
}

export function pricesConfigured(): boolean {
  return Boolean(url() && anon());
}

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) client = createClient(url()!, anon()!);
  return client;
}

// Оверрайди цін зберігаються ВИКЛЮЧНО в Supabase (таблиця `prices`) — спільне джерело правди.
// Локального кешу (localStorage) більше немає: без налаштованого Supabase оверрайдів немає.
export async function fetchPrices(): Promise<PriceMap> {
  if (!pricesConfigured()) return new Map();
  const map: PriceMap = new Map();
  try {
    const { data, error } = await getClient().from(TABLE).select("item_id, price, updated_at");
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Array<{ item_id: number; price: number; updated_at: string }>) {
      map.set(Number(row.item_id), { price: Number(row.price), updatedAt: row.updated_at });
    }
  } catch {
    // помилка мережі/запиту — повертаємо порожньо (локального фолбеку немає)
    return new Map();
  }
  return map;
}

export async function upsertPrice(itemId: number, price: number): Promise<PriceEntry> {
  if (!pricesConfigured()) throw new Error("Supabase не налаштовано — немає де зберегти ціну");
  const entry: PriceEntry = { price, updatedAt: new Date().toISOString() };
  const { error } = await getClient()
    .from(TABLE)
    .upsert(
      { item_id: itemId, price, updated_at: entry.updatedAt },
      { onConflict: "item_id" },
    );
  if (error) throw new Error(error.message);
  return entry;
}
