import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "react-hot-toast";
import { content } from "../../api/client";
import type { Content, ContentUpdate } from "../../types";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Alert } from "../ui/alert";
import { Skeleton } from "../ui/skeleton";
import ContentCard from "./ContentCard";
import ContentEditor from "./ContentEditor";
import ContentSection from "./ContentSection";
import CategoryTabs, { type ContentCategory } from "./CategoryTabs";
import { groupContentBySections, CONTENT_SECTIONS } from "./contentSections";

type StatusFilter = "active" | "inactive" | "all";

const ContentManager: React.FC = () => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [search, setSearch] = useState<string>("");
  const [category, setCategory] = useState<ContentCategory>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [viewMode] = useState<"grouped" | "grid">("grouped");

  const queryClient = useQueryClient();

  // Fetch content list
  const {
    data: contentList,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-content", { category, search, status }],
    queryFn: () =>
      content.list({
        category: category === "all" ? undefined : category,
        search: search || undefined,
        is_active: status === "all" ? undefined : status === "active",
        per_page: 100,
      }),
  });

  // Update content mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContentUpdate }) =>
      content.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      setEditingContent(null);
      setEditorOpen(false);
      toast.success("Content updated successfully");
    },
    onError: (error: AxiosError) => {
      console.error("Error updating content:", error);
      const errorData = error.response?.data as { detail?: string } | undefined;
      toast.error(
        `Failed to update content: ${errorData?.detail ?? error.message}`,
      );
    },
  });

  const handleEdit = (item: Content) => {
    setEditingContent(item);
    setEditorOpen(true);
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(id));
    updateMutation.mutate(
      { id, data: { is_active: isActive } },
      {
        onSettled: () => {
          setTogglingIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        },
      },
    );
  };

  const counts = useMemo(() => {
    const base: Record<ContentCategory, number> = {
      all: contentList?.total ?? 0,
      hero: 0,
      about: 0,
      contact: 0,
      navigation: 0,
      general: 0,
    };
    contentList?.content.forEach((c) => {
      const k = c.category as ContentCategory;
      if (k in base) base[k] += 1;
    });
    return base;
  }, [contentList]);

  const groupedContent = useMemo(() => {
    if (!contentList?.content) return {};
    return groupContentBySections(contentList.content);
  }, [contentList]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        Error loading content:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-semibold">Content Management</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Search by title, key, or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-80"
          />
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as StatusFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <CategoryTabs
        value={category}
        counts={counts}
        onValueChange={(v) => setCategory(v)}
      />

      {viewMode === "grouped" ? (
        <div className="space-y-6">
          {CONTENT_SECTIONS.map((sectionConfig) => {
            const sectionItems = groupedContent[sectionConfig.id] || [];
            if (sectionItems.length === 0 && category !== "all") return null;

            return (
              <ContentSection
                key={sectionConfig.id}
                title={sectionConfig.title}
                description={sectionConfig.description}
                items={sectionItems}
                defaultExpanded={sectionConfig.defaultExpanded}
              >
                {sectionItems.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    variant="compact"
                    onEdit={handleEdit}
                    onToggleActive={handleToggleActive}
                    isToggling={togglingIds.has(item.id)}
                  />
                ))}
              </ContentSection>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contentList?.content.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onToggleActive={handleToggleActive}
              isToggling={togglingIds.has(item.id)}
            />
          ))}
        </div>
      )}

      {contentList?.content.length === 0 && (
        <Alert className="mt-4">No content found.</Alert>
      )}

      <ContentEditor
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) setEditingContent(null);
        }}
        value={editingContent}
        onUpdate={(id: string, data: ContentUpdate) =>
          updateMutation.mutate({ id, data })
        }
      />
    </div>
  );
};

export default ContentManager;
