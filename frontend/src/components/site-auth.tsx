import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { getUserBySteamid } from "@/lib/auth/users";

export async function SiteAuth() {
  const t = await getTranslations("auth");

  let session: Awaited<ReturnType<typeof getSession>> = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }

  if (!session) {
    return (
      <Button asChild variant="outline" size="sm">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/auth/steam/login">
          <SteamIcon />
          {t("signInSteam")}
        </a>
      </Button>
    );
  }

  const user = await getUserBySteamid(session.sub);
  const displayName =
    user?.personaName?.trim() || `Steam ${session.sub.slice(-4)}`;

  return (
    <form action="/api/auth/logout" method="post" className="flex items-center gap-2">
      {user?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 rounded-full border border-border/60 object-cover"
        />
      ) : null}
      <span className="hidden max-w-[10rem] truncate text-sm font-medium md:inline">
        {displayName}
      </span>
      <Button type="submit" variant="ghost" size="sm">
        {t("signOut")}
      </Button>
    </form>
  );
}

function SteamIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M12 0C5.654 0 0.451 4.927 0 11.165l6.452 2.667a3.4 3.4 0 0 1 1.864-.55c.061 0 .121.003.181.005l2.871-4.158v-.058a4.531 4.531 0 0 1 9.063 0 4.531 4.531 0 0 1-4.59 4.529l-4.094 2.92c0 .052.004.103.004.155a3.42 3.42 0 0 1-3.42 3.42 3.42 3.42 0 0 1-3.337-2.66L.93 15.532C2.358 20.404 6.764 24 12 24c6.628 0 12-5.372 12-12S18.628 0 12 0zM7.523 18.205l-1.479-.611a2.59 2.59 0 0 0 1.347 1.348 2.586 2.586 0 0 0 3.387-1.4 2.572 2.572 0 0 0 .002-1.984 2.567 2.567 0 0 0-1.4-1.387 2.575 2.575 0 0 0-1.954-.018l1.529.633a1.901 1.901 0 1 1-1.461 3.512l.029-.093zm12.87-7.677a3.022 3.022 0 0 0-3.018-3.018 3.024 3.024 0 0 0-3.02 3.018 3.024 3.024 0 0 0 3.02 3.022 3.022 3.022 0 0 0 3.018-3.022zm-5.282-.005a2.265 2.265 0 0 1 4.527 0 2.265 2.265 0 1 1-4.527 0z" />
    </svg>
  );
}
