import React from "react";
import { cn } from "../../lib/utils";

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  wrap?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  wrap = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "bg-muted/50 p-1 border border-border",
        wrap
          ? "flex flex-wrap gap-1 rounded-2xl justify-center"
          : "flex h-12 rounded-2xl",
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-2 px-5 py-1.5 text-sm font-semibold rounded-xl transition-all duration-200",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span className="capitalize">{option.label}</span>
            {typeof option.badge === "number" && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  isActive
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
