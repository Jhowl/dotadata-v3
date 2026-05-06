"use client";

import { useEffect } from "react";

interface HtmlLangSyncProps {
  locale: string;
}

export function HtmlLangSync({ locale }: HtmlLangSyncProps) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return null;
}
