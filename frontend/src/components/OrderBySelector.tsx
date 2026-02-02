import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export type OrderByOption = "created_at" | "date_taken" | "order";

interface OrderBySelectorProps {
  value: OrderByOption;
  onChange: (value: OrderByOption) => void;
  className?: string;
}

const OPTIONS: Array<{
  value: OrderByOption;
  label: string;
  description: string;
}> = [
  {
    value: "created_at",
    label: "Upload Date",
    description: "Newest uploads first",
  },
  {
    value: "date_taken",
    label: "Capture Date",
    description: "Newest captures first",
  },
  {
    value: "order",
    label: "Default",
    description: "Arranged sequence",
  },
];

const OrderBySelector: React.FC<OrderBySelectorProps> = ({
  value,
  onChange,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-start sm:items-end gap-2 ${className}`}
    >
      <label className="text-sm font-medium text-muted-foreground">
        Display Order
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-w-[150px] border-border/40">
          <SelectValue>
            {OPTIONS.find((opt) => opt.value === value)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {value === "order" && (
          <span
            className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_1px_rgba(245,158,11,0.45)]"
            aria-hidden
          />
        )}
        <span>
          {OPTIONS.find((option) => option.value === value)?.description ?? ""}
        </span>
      </div>
    </div>
  );
};

export default OrderBySelector;
