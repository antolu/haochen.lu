import React from "react";
import { SegmentedControl } from "./SegmentedControl";

export type ContentCategory =
  | "all"
  | "hero"
  | "about"
  | "contact"
  | "social"
  | "navigation"
  | "general";

interface CategoryTabsProps {
  value: ContentCategory;
  counts: Partial<Record<ContentCategory, number>>;
  onValueChange: (value: ContentCategory) => void;
}

const CATEGORIES: ContentCategory[] = [
  "all",
  "hero",
  "about",
  "contact",
  "social",
  "navigation",
  "general",
];

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  value,
  counts,
  onValueChange,
}) => {
  return (
    <SegmentedControl
      wrap
      options={CATEGORIES.map((cat) => ({
        value: cat,
        label: cat,
        badge: counts[cat],
      }))}
      value={value}
      onChange={onValueChange}
    />
  );
};

export default CategoryTabs;
