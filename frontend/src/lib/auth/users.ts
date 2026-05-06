import { supabaseAdmin } from "@/lib/supabase/client";

export type AppUser = {
  steamid64: string;
  personaName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
};

type UpsertInput = {
  steamid: string;
  personaName?: string | null;
  avatarUrl?: string | null;
  profileUrl?: string | null;
};

export const upsertSteamUser = async (input: UpsertInput): Promise<void> => {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("users").upsert(
    {
      steamid64: input.steamid,
      persona_name: input.personaName ?? null,
      avatar_url: input.avatarUrl ?? null,
      profile_url: input.profileUrl ?? null,
      last_login_at: new Date().toISOString(),
    },
    { onConflict: "steamid64" },
  );
};

export const getUserBySteamid = async (steamid: string): Promise<AppUser | null> => {
  if (!supabaseAdmin) {
    return { steamid64: steamid, personaName: null, avatarUrl: null, profileUrl: null };
  }
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("steamid64, persona_name, avatar_url, profile_url")
    .eq("steamid64", steamid)
    .maybeSingle();
  if (error || !data) return null;
  return {
    steamid64: data.steamid64 as string,
    personaName: (data.persona_name as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
    profileUrl: (data.profile_url as string | null) ?? null,
  };
};
