import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface FeedbackEntry {
  id: number;
  name: string | null;
  message: string;
  createdAt: string;
}

const TABLE = "feedback";

function url(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL as string | undefined;
}
function anon(): string | undefined {
  return import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
}

export function feedbackConfigured(): boolean {
  return Boolean(url() && anon());
}

// Feedback is stored in Supabase (table `feedback`), the same backend as prices.
// Anyone can read the list and append a new entry; there is no local fallback.
let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) client = createClient(url()!, anon()!);
  return client;
}

export async function fetchFeedback(): Promise<FeedbackEntry[]> {
  if (!feedbackConfigured()) return [];
  const { data, error } = await getClient()
    .from(TABLE)
    .select("id, name, message, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: number; name: string | null; message: string; created_at: string }>).map(
    (row) => ({
      id: Number(row.id),
      name: row.name,
      message: row.message,
      createdAt: row.created_at,
    }),
  );
}

export async function submitFeedback(name: string, message: string): Promise<FeedbackEntry> {
  if (!feedbackConfigured()) throw new Error("Supabase is not configured — nowhere to store feedback");
  const trimmedName = name.trim();
  const payload = { name: trimmedName || null, message: message.trim() };
  const { data, error } = await getClient().from(TABLE).insert(payload).select("id, name, message, created_at").single();
  if (error) throw new Error(error.message);
  const row = data as { id: number; name: string | null; message: string; created_at: string };
  return { id: Number(row.id), name: row.name, message: row.message, createdAt: row.created_at };
}
