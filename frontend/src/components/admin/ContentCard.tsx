import React from "react";
import type { Content } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { formatDateTime } from "../../utils/dateFormat";
import { cn } from "../../lib/utils";
import { Pencil } from "lucide-react";

interface ContentCardProps {
  item: Content;
  onEdit: (item: Content) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  isToggling?: boolean;
  variant?: "default" | "compact";
}

const typeToBadge: Record<string, string> = {
  text: "bg-secondary text-secondary-foreground",
  html: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  markdown:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

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
  onToggleActive,
  isToggling = false,
  variant = "default",
}) => {
  const preview = getSmartPreview(
    item.content || "",
    variant === "compact" ? 80 : 140,
  );

  if (variant === "compact") {
    return (
      <Card className="border-l-4 border-l-primary/20 hover:border-l-primary/40 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium truncate">{item.title}</h4>
                <Badge
                  className={cn(
                    "text-[10px] px-1.5 py-0.5",
                    typeToBadge[item.content_type] ?? typeToBadge.text,
                  )}
                >
                  {item.content_type}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                  {item.key}
                </code>
                <span>•</span>
                <span title={item.updated_at}>
                  {formatDateTime(item.updated_at)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {preview}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    item.is_active
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                >
                  {item.is_active ? "Active" : "Inactive"}
                </span>
                <Switch
                  checked={item.is_active}
                  onCheckedChange={(checked) =>
                    onToggleActive(item.id, checked)
                  }
                  disabled={isToggling}
                  aria-label={`Toggle active for ${item.title}`}
                  className="scale-75"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEdit(item)}
                aria-label="Edit content"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{item.title}</CardTitle>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5">{item.key}</code>
              <span>•</span>
              <span className="capitalize">{item.category}</span>
              <span>•</span>
              <span title={item.updated_at}>
                Updated {formatDateTime(item.updated_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "text-xs",
                typeToBadge[item.content_type] ?? typeToBadge.text,
              )}
            >
              {item.content_type}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(item)}
              aria-label="Edit content"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <p className="text-sm text-foreground line-clamp-4">{preview}</p>
        <div className="mt-auto flex items-center justify-between">
          <span
            className={cn(
              "text-xs font-medium",
              item.is_active
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground",
            )}
          >
            {item.is_active ? "Active" : "Inactive"}
          </span>
          <Switch
            checked={item.is_active}
            onCheckedChange={(checked) => onToggleActive(item.id, checked)}
            disabled={isToggling}
            aria-label={`Toggle active for ${item.title}`}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ContentCard;
