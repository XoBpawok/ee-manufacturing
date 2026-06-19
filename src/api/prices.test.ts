import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn(() => ({ select: selectMock, upsert: upsertMock }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: fromMock })),
}));

import { fetchPrices, upsertPrice, pricesConfigured } from "./prices";

beforeEach(() => {
  upsertMock.mockReset();
  selectMock.mockReset();
  fromMock.mockClear();
  vi.unstubAllEnvs();
});

describe("pricesConfigured", () => {
  it("true лише коли задані обидві env-змінні", () => {
    expect(pricesConfigured()).toBe(false);
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    expect(pricesConfigured()).toBe(true);
  });
});

describe("fetchPrices", () => {
  it("мапить рядки з Supabase", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    selectMock.mockResolvedValue({
      data: [{ item_id: 34, price: 5.5, updated_at: "2026-06-18T00:00:00.000Z" }],
      error: null,
    });
    const map = await fetchPrices();
    expect(map.get(34)).toEqual({ price: 5.5, updatedAt: "2026-06-18T00:00:00.000Z" });
  });

  it("без env повертає порожню мапу", async () => {
    const map = await fetchPrices();
    expect(map.size).toBe(0);
  });

  it("при помилці запиту повертає порожню мапу", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    selectMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const map = await fetchPrices();
    expect(map.size).toBe(0);
  });
});

describe("upsertPrice", () => {
  it("пише в Supabase з updated_at і повертає entry", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    upsertMock.mockResolvedValue({ error: null });
    const entry = await upsertPrice(34, 12);
    expect(entry.price).toBe(12);
    expect(typeof entry.updatedAt).toBe("string");
    const arg = upsertMock.mock.calls[0][0];
    expect(arg).toMatchObject({ item_id: 34, price: 12 });
    expect(arg.updated_at).toBe(entry.updatedAt);
  });

  it("без env кидає помилку (немає де зберегти)", async () => {
    await expect(upsertPrice(34, 12)).rejects.toThrow();
  });
});
