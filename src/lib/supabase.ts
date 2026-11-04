import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import type { Database } from "./database.types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Add them to .env.local and restart Expo.",
  );
}

// app.json sets web.output to "server", so this file can also run on a server,
// where there is no browser storage and no user session to keep.
const isServerRender = Platform.OS === "web" && typeof window === "undefined";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Keeps the user signed in after the app restarts.
    storage: isServerRender ? undefined : AsyncStorage,
    persistSession: !isServerRender,
    autoRefreshToken: !isServerRender,
    // Only used by browser redirect logins, which this app doesn't have yet.
    detectSessionInUrl: false,
  },
});

// Timers don't run reliably while a mobile app is in the background, so refresh
// tokens only while it's active. Browsers don't need this.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
