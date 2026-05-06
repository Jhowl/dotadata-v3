import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center gap-1 w-fit shrink-0 whitespace-nowrap overflow-hidden",
    "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
    "[&>svg]:size-3 [&>svg]:pointer-events-none",
    "transition-[color,box-shadow,background-color,border-color]",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:brightness-110",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:brightness-105",
        accent:
          "border-transparent bg-accent text-accent-foreground [a&]:hover:brightness-105",
        success:
          "border-transparent bg-success/15 text-success [a&]:hover:bg-success/20",
        warning:
          "border-transparent bg-warning/15 text-warning [a&]:hover:bg-warning/20",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:brightness-105",
        outline:
          "border-border-strong text-foreground [a&]:hover:bg-surface-2",
        muted:
          "border-transparent bg-muted text-muted-foreground [a&]:hover:bg-muted/70",
        live: [
          "border-primary/30 bg-primary/12 text-primary",
          "before:content-[''] before:size-1.5 before:rounded-full before:bg-primary before:shadow-[0_0_6px_currentColor]",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
