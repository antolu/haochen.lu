import * as React from "react";
import { cn } from "../../lib/utils";

type Variant = "default" | "destructive" | "success" | "warning";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantClasses =
      variant === "destructive"
        ? "border-red-400/40 text-red-900 dark:text-red-300 bg-red-50 dark:bg-red-950"
        : variant === "success"
          ? "border-green-400/40 text-green-900 dark:text-green-300 bg-green-50 dark:bg-green-950"
          : variant === "warning"
            ? "border-amber-400/40 text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950"
            : "border-slate-200 text-slate-900 dark:text-slate-300 bg-card";

    return (
      <div
        ref={ref}
        className={cn(
          "w-full rounded-md border p-4 text-sm",
          variantClasses,
          className,
        )}
        role="alert"
        {...props}
      />
    );
  },
);
Alert.displayName = "Alert";
