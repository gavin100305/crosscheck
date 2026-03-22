/* eslint-disable react-refresh/only-export-components */
"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none outline-none transition-[filter] duration-200 focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-linear-to-b dark:bg-linear-to-t from-primary/85 to-primary text-primary-foreground inset-shadow-2xs inset-shadow-white/25 border border-foreground/20 dark:border-0 shadow-md shadow-foreground/10 hover:brightness-110 active:brightness-95",
       secondary:
          "bg-linear-to-b dark:bg-linear-to-t from-secondary/85 to-secondary text-primary-foreground inset-shadow-2xs inset-shadow-white/25 border border-foreground/20 dark:border-0 shadow-md shadow-foreground/10 hover:brightness-110 active:brightness-95",
        destructive:
          "bg-linear-to-b dark:bg-linear-to-t from-destructive/85 to-destructive text-destructive-foreground inset-shadow-2xs inset-shadow-white/25 border border-foreground/20 dark:border-0 shadow-md shadow-foreground/10 hover:brightness-110 active:brightness-95",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted hover:brightness-105 active:brightness-95",
        ghost:
          "bg-transparent text-foreground hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-4 py-2 text-sm",
        xs: "h-6 gap-1 px-2.5 text-xs",
        sm: "h-8 gap-1.5 px-3 text-sm",
        md: "h-9 gap-1.5 px-4 text-sm",
        lg: "h-10 gap-1.5 px-6 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export function Button({ className, variant, size, ...props }) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { buttonVariants }