import React, { useMemo, useState, useEffect } from "react";
import type { Content, ContentCreate, ContentUpdate } from "../../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
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
      const timer = setTimeout(() => {
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
      }, 0);
      return () => clearTimeout(timer);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Content" : "Create Content"}
          </DialogTitle>
        </DialogHeader>

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

          {isEditing ? (
            <div className="pb-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                Title
              </Label>
              <div className="text-lg font-medium">{title}</div>
            </div>
          ) : (
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Human-readable title"
              />
            </div>
          )}

          {contentType === "text" && (
            <div>
              <Label htmlFor="content">Content</Label>
              {content.includes("\n") || content.length > 80 ? (
                <Textarea
                  id="content"
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter text..."
                />
              ) : (
                <Input
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter text..."
                />
              )}
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

          <DialogFooter className="pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit}>
              {isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContentEditor;
