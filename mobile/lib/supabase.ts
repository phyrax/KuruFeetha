import "react-native-url-polyfill/auto";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const url = String(Constants.expoConfig?.extra?.supabaseUrl ?? "");
const anonKey = String(Constants.expoConfig?.extra?.supabaseAnonKey ?? "");
const storage = { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync };

export const authConfigured = Boolean(url && anonKey);
export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder", {
  auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
