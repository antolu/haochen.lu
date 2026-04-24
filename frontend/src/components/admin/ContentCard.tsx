import React from "react";
import type { Content } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { formatDateTime } from "../../utils/dateFormat";
import { Pencil } from "lucide-react";

interface ContentCardProps {
  item: Content;
  onEdit: (item: Content) => void;
  variant?: "default" | "compact";
}
// Smart preview that respects word boundaries
const getSmartPreview = (text: string, maxLength: number = 140): string => {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(" ");

  // If there's no space or it's too early, use simple truncation
  if (lastSpaceIndex < maxLength * 0.7) {
    return `${truncated}…`;
  }

  return `${truncated.slice(0, lastSpaceIndex)}…`;
};

export const ContentCard: React.FC<ContentCardProps> = ({
  item,
  onEdit,
  variant = "default",
}) => {
  const preview = getSmartPreview(
    item.content || "",
    variant === "compact" ? 80 : 140,
  );

  if (variant === "compact") {
    return (
      <Card
        className="border-l-4 border-l-primary/20 hover:border-l-primary/40 transition-all cursor-pointer hover:bg-accent/5 group"
        onClick={() => onEdit(item)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium truncate">{item.title}</h4>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <span title={item.updated_at}>
                  {formatDateTime(item.updated_at)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {preview}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              aria-label="Edit content"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="h-full flex flex-col cursor-pointer hover:bg-accent/5 hover:border-primary/20 transition-all group"
      onClick={() => onEdit(item)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{item.title}</CardTitle>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{item.category}</span>
              <span>•</span>
              <span title={item.updated_at}>
                Updated {formatDateTime(item.updated_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              aria-label="Edit content"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <p className="text-sm text-foreground line-clamp-4">{preview}</p>
      </CardContent>
    </Card>
  );
};

export default ContentCard;
