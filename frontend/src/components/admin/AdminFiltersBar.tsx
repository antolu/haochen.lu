import React from "react";
import { Search } from "lucide-react";
import { Input } from "../ui/input";

interface AdminFiltersBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

export function AdminFiltersBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  children,
}: AdminFiltersBarProps) {
  return (
    <div className="mb-6 bg-muted/30 p-6 rounded-xl">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ paddingLeft: "2.5rem" }}
          />
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
    </div>
  );
}
