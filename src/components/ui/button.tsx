/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { tbCn } from "@/components/toybox/cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-toy-md border-3 border-transparent font-display font-black whitespace-nowrap transition-[translate,box-shadow,background-color] duration-120 ease-out outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:pointer-events-none disabled:border-ink-muted disabled:bg-surface-sunken disabled:text-ink-muted disabled:shadow-none aria-invalid:border-destructive motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // toybox secondary：白底墨框硬陰影，hover 浮起、active 陷入
        default:
          "border-line bg-surface-raised text-ink shadow-hard-s hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-m active:translate-x-[3px] active:translate-y-[3px] active:shadow-none aria-expanded:bg-surface-sunken",
        primary:
          "border-line bg-action text-on-fill shadow-hard-s hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-m active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        pop:
          "border-line bg-pop text-on-fill shadow-hard-s hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-m active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        ink:
          "border-line bg-inverse text-pop shadow-hard-s hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-m active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        outline:
          "border-line bg-surface-raised text-ink shadow-hard-s hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-m active:translate-x-[3px] active:translate-y-[3px] active:shadow-none aria-expanded:bg-surface-sunken",
        secondary:
          "border-line bg-surface-raised text-ink shadow-hard-s hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-m active:translate-x-[3px] active:translate-y-[3px] active:shadow-none aria-expanded:bg-surface-sunken",
        ghost:
          "bg-transparent text-ink shadow-none hover:bg-surface-sunken aria-expanded:bg-surface-sunken",
        destructive:
          "border-destructive bg-surface-raised text-destructive shadow-hard-s shadow-destructive hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-m active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-destructive",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 text-button-s has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-toy-sm px-2 text-caption in-data-[slot=button-group]:rounded-toy-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-toy-sm px-2.5 text-caption in-data-[slot=button-group]:rounded-toy-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 text-button-s has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-toy-sm in-data-[slot=button-group]:rounded-toy-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-toy-sm in-data-[slot=button-group]:rounded-toy-md",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={tbCn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
