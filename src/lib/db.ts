import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export interface Swimmer {
  id: string;
  csps_user_id: number;
  first_name: string;
  last_name: string;
  birth_year: number | null;
  gender: "FEMALE" | "MALE";
  club_abbrev: string | null;
  club_name: string | null;
  is_primary: boolean;
  source: string;
  active: boolean;
}

export interface Result {
  id: string;
  swimmer_id: string;
  discipline: string;
  pool_length: number;
  time_ms: number;
  is_dsq: boolean;
  is_split: boolean;
  points: number | null;
  swim_date: string;
  competition_csps_id: number | null;
  competition_title: string | null;
  location: string | null;
}

export interface RankingSnapshot {
  snapshot_date: string;
  discipline: string;
  pool_length: number;
  birth_year: number;
  gender: string;
  total_swimmers: number;
  best_time_ms: number | null;
  median_time_ms: number | null;
  p10_time_ms: number | null;
  p90_time_ms: number | null;
  primary_rank: number | null;
  primary_time_ms: number | null;
}

export interface Badge {
  id: string;
  swimmer_id: string;
  badge_key: string;
  label: string;
  emoji: string | null;
  earned_at: string;
}
