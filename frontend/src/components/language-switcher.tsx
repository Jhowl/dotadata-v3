"use client";

import { Globe } from "lucide-react";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
] as const;

interface LanguageSwitcherProps {
  currentLocale: string;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const select = (locale: "en" | "ru") => {
    startTransition(() => {
      router.replace(pathname, { locale });
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Change language"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            isPending && "opacity-60",
          )}
        >
          <Globe className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onSelect={() => select(locale.code)}
            className={cn(
              "cursor-pointer",
              currentLocale === locale.code && "font-semibold text-primary",
            )}
          >
            {locale.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
