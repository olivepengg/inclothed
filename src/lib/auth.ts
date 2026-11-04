import { supabase } from "./supabase";

/**
 * Returns the current user's id, creating an anonymous user the first time.
 *
 * Row Level Security needs a signed-in user, and an anonymous user counts as one.
 * Each device gets its own anonymous user, so devices don't share a closet yet.
 * Signing out or reinstalling the app loses access to that user's data.
 *
 * To support real accounts later:
 * 1. Enable manual identity linking in the Supabase dashboard.
 * 2. Build a login screen with supabase.auth.signInWithPassword or signInWithOtp.
 * 3. Upgrade anonymous users so they keep their data, using
 *    supabase.auth.updateUser({ email }) or supabase.auth.linkIdentity({ provider }).
 * 4. Stop calling signInAnonymously here, and send signed-out users to the login screen.
 *
 * The RLS policies don't need to change, because they only compare user ids.
 * Closets already created on other devices would need merging by hand.
 */
export async function ensureSignedIn(): Promise<string> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session) return sessionData.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Anonymous sign-in returned no user");
  return data.user.id;
}
