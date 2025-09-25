import React from "react";

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
      <label
        className="text-sm font-medium text-gray-600"
        htmlFor="order-by-select"
      >
        Display Order
      </label>
      <div className="relative inline-flex items-center">
        <select
          id="order-by-select"
          value={value}
          onChange={(event) => {
            onChange(event.target.value as OrderByOption);
          }}
          className="appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2 pr-16 text-sm font-medium text-gray-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-[150px]"
        >
          {OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
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
