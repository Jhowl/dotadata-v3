"use client";

import { ReactNode, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface ClientChartFrameProps {
  className: string;
  children: ReactNode;
}

export function ClientChartFrame({ className, children }: ClientChartFrameProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          className,
          "rounded-xl border border-border/40 bg-muted/20",
        )}
      />
    );
  }

  return <div className={className}>{children}</div>;
}
