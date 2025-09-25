import React, { useMemo, useState, useEffect } from "react";
import type { Content, ContentCreate, ContentUpdate } from "../../types";
import { Sheet, SheetContent } from "../ui/sheet";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import MDEditor from "@uiw/react-md-editor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

type EditorMode = "text" | "html" | "markdown";

interface ContentEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: Content | null;
  onCreate?: (data: ContentCreate) => void;
  onUpdate: (id: string, data: ContentUpdate) => void;
}

export const ContentEditor: React.FC<ContentEditorProps> = ({
  open,
  onOpenChange,
  value,
  onCreate,
  onUpdate,
}) => {
  const isEditing = !!value;
  const [keyField, setKeyField] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<string>("general");
  const [contentType, setContentType] = useState<EditorMode>("text");
  const [content, setContent] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);

  // Reset form when value changes or modal opens/closes
  useEffect(() => {
    if (open) {
      if (value) {
        setKeyField(value.key);
        setTitle(value.title);
        setCategory(value.category);
        setContentType(value.content_type as EditorMode);
        setContent(value.content);
        setIsActive(value.is_active);
      } else {
        // Reset to defaults for new content
        setKeyField("");
        setTitle("");
        setCategory("general");
        setContentType("text");
        setContent("");
        setIsActive(true);
      }
    }
  }, [open, value]);

  const canSubmit = useMemo(
    () =>
      title.trim().length > 0 &&
      (!isEditing ? keyField.trim().length > 0 : true),
    [title, keyField, isEditing],
  );

  const handleSave = () => {
    if (!canSubmit) return;
    if (isEditing && value) {
      onUpdate(value.id, {
        title,
        category,
        content_type: contentType,
        content,
        is_active: isActive,
      });
    } else if (onCreate) {
      onCreate({
        key: keyField,
        title,
        category,
        content_type: contentType,
        content,
        is_active: isActive,
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" widthClassName="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isEditing ? "Edit Content" : "Create Content"}
          </h3>
        </div>

        <div className="space-y-4">
          {!isEditing && (
            <div>
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                value={keyField}
                onChange={(e) => setKeyField(e.target.value)}
                placeholder="e.g., hero.title"
              />
            </div>
          )}

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Human-readable title"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "hero",
                      "about",
                      "contact",
                      "navigation",
                      "general",
                    ] as const
                  ).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Content Type</Label>
              <Select
                value={contentType}
                onValueChange={(v) => setContentType(v as EditorMode)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">text</SelectItem>
                  <SelectItem value="html">html</SelectItem>
                  <SelectItem value="markdown">markdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {contentType === "text" && (
            <div>
              <Label>Content</Label>
              <Textarea
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          )}

          {contentType === "html" && (
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <Textarea
                  rows={14}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="preview">
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </TabsContent>
            </Tabs>
          )}

          {contentType === "markdown" && (
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <MDEditor
                  value={content}
                  onChange={(v) => setContent(v ?? "")}
                  height={320}
                  preview="edit"
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex items-center gap-2">
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="is_active" className="text-sm">
              Active (content will be displayed on the website)
            </Label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit}>
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ContentEditor;
