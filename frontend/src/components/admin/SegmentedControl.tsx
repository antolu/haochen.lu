import React from "react";
import { cn } from "../../lib/utils";

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
              isActive
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
            )}
          >
            {Icon && (
              <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "")} />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
