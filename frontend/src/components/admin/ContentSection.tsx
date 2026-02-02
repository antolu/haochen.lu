import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import type { Content } from "../../types";

interface ContentSectionProps {
  title: string;
  description?: string;
  items: Content[];
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  title,
  description,
  items,
  defaultExpanded = true,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card className="w-full">
      <div
        className="flex items-center justify-between p-4 cursor-pointer border-b hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="p-0 h-6 w-6">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>

        <span className="text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-none" : "max-h-0",
        )}
      >
        <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No content items in this section yet.
            </p>
          ) : (
            children
          )}
        </div>
      </div>
    </Card>
  );
};

export default ContentSection;
