import React from "react";
import type { Content } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { formatDateTime } from "../../utils/dateFormat";
import { cn } from "../../lib/utils";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

interface ContentCardProps {
  item: Content;
  onEdit: (item: Content) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

const typeToBadge: Record<string, string> = {
  text: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
  html: "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200",
  markdown:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export const ContentCard: React.FC<ContentCardProps> = ({
  item,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  const preview =
    item.content?.length > 140
      ? `${item.content.slice(0, 140)}…`
      : item.content;

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onEdit(item)}
                  className="cursor-pointer"
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(item.id)}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground line-clamp-4">{preview}</p>
        <div className="mt-auto flex items-center justify-between">
          <span
            className={cn(
              "text-xs",
              item.is_active ? "text-emerald-600" : "text-muted-foreground",
            )}
          >
            {item.is_active ? "Active" : "Inactive"}
          </span>
          <Switch
            checked={item.is_active}
            onCheckedChange={(checked) => onToggleActive(item.id, checked)}
            aria-label={`Toggle active for ${item.title}`}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ContentCard;
