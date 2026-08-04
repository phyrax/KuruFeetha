"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!clientPromise) clientPromise = fetch("/api/v1/auth/config")
    .then((response) => response.json() as Promise<{ configured: boolean; url?: string; anonKey?: string }>)
    .then((config) => config.configured && config.url && config.anonKey
      ? createClient(config.url, config.anonKey, { auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } })
      : null)
    .catch(() => null);
  return clientPromise;
}
