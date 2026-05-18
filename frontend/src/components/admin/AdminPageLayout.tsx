import React from "react";
import { cn } from "../../lib/utils";

interface AdminPageLayoutProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

export function AdminPageLayout({
  title,
  description,
  actions,
  children,
  maxWidth,
}: AdminPageLayoutProps) {
  const inner = (
    <>
      <div className="mb-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground text-lg">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-4">{actions}</div>
          )}
        </div>
      </div>
      {children}
    </>
  );

  if (maxWidth) {
    return <div className={cn("mx-auto", maxWidth)}>{inner}</div>;
  }

  return <div>{inner}</div>;
}
