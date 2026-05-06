const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";
const STEAM_OPENID_NS = "http://specs.openid.net/auth/2.0";
const STEAM_OPENID_IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
const STEAM_CLAIMED_ID_PREFIX = "https://steamcommunity.com/openid/id/";

export const buildSteamLoginUrl = (origin: string): string => {
  const params = new URLSearchParams({
    "openid.ns": STEAM_OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": `${origin}/api/auth/steam/callback`,
    "openid.realm": origin,
    "openid.identity": STEAM_OPENID_IDENTIFIER_SELECT,
    "openid.claimed_id": STEAM_OPENID_IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID_URL}?${params.toString()}`;
};

export const verifySteamOpenId = async (
  searchParams: URLSearchParams,
): Promise<string | null> => {
  if (searchParams.get("openid.mode") !== "id_res") return null;

  const claimedId = searchParams.get("openid.claimed_id") ?? "";
  if (!claimedId.startsWith(STEAM_CLAIMED_ID_PREFIX)) return null;
  const steamid = claimedId.slice(STEAM_CLAIMED_ID_PREFIX.length);
  if (!/^\d{17}$/.test(steamid)) return null;

  const verifyParams = new URLSearchParams(searchParams);
  verifyParams.set("openid.mode", "check_authentication");

  let response: Response;
  try {
    response = await fetch(STEAM_OPENID_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyParams.toString(),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const text = await response.text();
  if (!/is_valid\s*:\s*true/i.test(text)) return null;

  return steamid;
};

export type SteamProfile = {
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
};

export const fetchSteamProfile = async (steamid: string): Promise<SteamProfile | null> => {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(
    apiKey,
  )}&steamids=${encodeURIComponent(steamid)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      response?: { players?: Array<Record<string, string>> };
    };
    const player = data.response?.players?.[0];
    if (!player) return null;
    return {
      personaName: player.personaname ?? "",
      avatarUrl: player.avatarfull ?? player.avatarmedium ?? player.avatar ?? "",
      profileUrl: player.profileurl ?? "",
    };
  } catch {
    return null;
  }
};
