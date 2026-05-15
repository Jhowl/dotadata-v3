"use client";

import { CSSProperties, ReactNode, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface ClientChartFrameProps {
  className: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function ClientChartFrame({ className, children, style }: ClientChartFrameProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        aria-hidden="true"
        style={style}
        className={cn(
          className,
          "rounded-xl border border-border/40 bg-muted/20",
        )}
      />
    );
  }

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
