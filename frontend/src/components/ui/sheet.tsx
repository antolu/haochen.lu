import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils";

export const Sheet = (
  props: React.ComponentProps<typeof DialogPrimitive.Root>,
) => <DialogPrimitive.Root {...props} />;
export const SheetTrigger = (
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) => <DialogPrimitive.Trigger {...props} />;
export const SheetClose = (
  props: React.ComponentProps<typeof DialogPrimitive.Close>,
) => <DialogPrimitive.Close {...props} />;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "right" | "left" | "top" | "bottom";
    widthClassName?: string;
  }
>(
  (
    { className, side = "right", widthClassName = "w-full max-w-md", ...props },
    ref,
  ) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 bg-card p-6 shadow-lg border-l border-border",
          side === "right" && cn("top-0 right-0 h-full", widthClassName),
          side === "left" &&
            cn("top-0 left-0 h-full border-l-0 border-r", widthClassName),
          side === "top" && "top-0 left-0 w-full border-l-0 border-b",
          side === "bottom" && "bottom-0 left-0 w-full border-l-0 border-t",
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  ),
);
SheetContent.displayName = "SheetContent";
