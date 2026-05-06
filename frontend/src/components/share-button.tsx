"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  className?: string;
  variant?: "compact" | "default";
}

const SITE_ORIGIN = "https://dotadata.org";

const buildFullUrl = (url: string) => {
  if (url.startsWith("http")) return url;
  if (typeof window !== "undefined") return `${window.location.origin}${url}`;
  return `${SITE_ORIGIN}${url}`;
};

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12" />
  </svg>
);

const RedditIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M12 0a12 12 0 1 0 12 12A12 12 0 0 0 12 0m5.01 4.744a1.535 1.535 0 0 1 1.5 1.532 1.532 1.532 0 1 1-3.063-.063l-2.713-.575-.85 3.985a8.25 8.25 0 0 1 4.587 1.474l1.012-1.013a1.6 1.6 0 0 1 .013-2.137 1.6 1.6 0 1 1 2.275 2.262 1.6 1.6 0 0 1-1.875.288L17 11.512a8 8 0 0 1 1.6 4.7c0 3.262-3.875 6.013-8.6 6.013S1.4 19.474 1.4 16.212a8 8 0 0 1 1.6-4.7l-.875-.875a1.6 1.6 0 0 1-1.875-.288 1.6 1.6 0 1 1 2.288-2.262 1.6 1.6 0 0 1 .012 2.137l1.012 1.013a8.25 8.25 0 0 1 4.588-1.474l.95-4.487a.34.34 0 0 1 .137-.213.36.36 0 0 1 .25-.063l3.137.7a1.523 1.523 0 0 1 1.4-.95zM7.625 13.499a1.5 1.5 0 1 0 1.5 1.5 1.5 1.5 0 0 0-1.5-1.5m6.762 0a1.5 1.5 0 1 0 1.5 1.5 1.5 1.5 0 0 0-1.5-1.5zm-6.475 4.238a.337.337 0 0 0-.237.575 4.45 4.45 0 0 0 3.137 1.3 4.45 4.45 0 0 0 3.138-1.3.336.336 0 0 0-.013-.488.337.337 0 0 0-.475 0 3.8 3.8 0 0 1-2.65 1.075 3.8 3.8 0 0 1-2.65-1.075.34.34 0 0 0-.25-.087" />
  </svg>
);

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.83 9.83 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.9 11.9 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413" />
  </svg>
);

const TelegramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm.276 3.716c.554 0 .753.527.566 1.302l-3.357 14.155c-.157.683-.604.85-1.166.531l-3.222-2.376-1.554 1.497c-.172.172-.317.317-.65.317l.234-3.301 6.013-5.43c.262-.234-.057-.355-.4-.121L7.4 13.954l-3.184-.99c-.69-.213-.704-.69.144-1.018l12.426-4.788c.572-.21 1.075.142.892.92" />
  </svg>
);

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065m1.782 13.019H3.555V9h3.564zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
  </svg>
);

export function ShareButton({
  title,
  text,
  url,
  className,
  variant = "default",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const fullUrl = buildFullUrl(url);
    try {
      await navigator.clipboard.writeText(`${text}\n${fullUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  };

  const handleNative = async () => {
    const fullUrl = buildFullUrl(url);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url: fullUrl });
      } catch {
        // user cancelled — ignore
      }
    } else {
      handleCopy();
    }
  };

  const fullUrl = typeof window !== "undefined" ? buildFullUrl(url) : `${SITE_ORIGIN}${url}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedText = encodeURIComponent(text);
  const encodedTitle = encodeURIComponent(title);

  const platforms = [
    {
      name: "X / Twitter",
      icon: TwitterIcon,
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      color: "text-foreground",
    },
    {
      name: "Facebook",
      icon: FacebookIcon,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      color: "text-[#1877F2]",
    },
    {
      name: "Reddit",
      icon: RedditIcon,
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      color: "text-[#FF4500]",
    },
    {
      name: "WhatsApp",
      icon: WhatsAppIcon,
      href: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`,
      color: "text-[#25D366]",
    },
    {
      name: "Telegram",
      icon: TelegramIcon,
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      color: "text-[#229ED9]",
    },
    {
      name: "LinkedIn",
      icon: LinkedinIcon,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: "text-[#0A66C2]",
    },
  ];

  const isCompact = variant === "compact";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Share ${title}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors",
            "border-border/60 bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            isCompact ? "px-2.5 py-1.5 text-xs" : "px-3 py-1.5 text-sm",
            copied && "border-primary/30 text-primary",
            className,
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Share"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Share to
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {platforms.map((platform) => {
          const Icon = platform.icon;
          return (
            <DropdownMenuItem key={platform.name} asChild>
              <a
                href={platform.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-2 cursor-pointer"
              >
                <Icon className={cn("h-4 w-4", platform.color)} />
                <span>{platform.name}</span>
              </a>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleCopy} className="cursor-pointer">
          {copied ? (
            <>
              <Check className="h-4 w-4 text-primary" />
              <span>Link copied!</span>
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4" />
              <span>Copy link</span>
            </>
          )}
        </DropdownMenuItem>
        {typeof navigator !== "undefined" && "share" in navigator ? (
          <DropdownMenuItem onSelect={handleNative} className="cursor-pointer">
            <Share2 className="h-4 w-4" />
            <span>More…</span>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
