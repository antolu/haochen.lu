import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

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

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  value,
  counts,
  onValueChange,
}) => {
  const categories: ContentCategory[] = [
    "all",
    "hero",
    "about",
    "contact",
    "social",
    "navigation",
    "general",
  ];

  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v as ContentCategory)}
    >
      <TabsList className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <TabsTrigger key={cat} value={cat} className="capitalize">
            {cat}
            {typeof counts[cat] === "number" && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {counts[cat]}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* This component only renders tab headers; content is managed by parent */}
      <TabsContent value={value} />
    </Tabs>
  );
};

export default CategoryTabs;
