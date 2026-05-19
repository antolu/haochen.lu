import React from "react";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";

interface AdminEmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function AdminEmptyState({
  icon,
  heading,
  description,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="p-8 text-center">
      {icon && (
        <div className="text-muted-foreground mb-4 flex justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium mb-2">{heading}</h3>
      {description && (
        <p className="text-muted-foreground mb-4">{description}</p>
      )}
      {action && (
        <Button
          variant="gradient"
          size="lg"
          className="rounded-full px-8 shadow-xl shadow-primary/20"
          onClick={action.onClick}
        >
          <Plus className="w-4 h-4 mr-2" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
