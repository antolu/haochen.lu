import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { Photo } from "../../types";
import { useUpdatePhoto, usePhotoTags } from "../../hooks/usePhotos";
import TagMultiSelect from "./TagMultiSelect";
import { Button } from "../ui/button";

interface PhotoEditorDrawerProps {
  photo: Photo | null;
  onClose: () => void;
}

const PhotoEditorDrawer: React.FC<PhotoEditorDrawerProps> = ({
  photo,
  onClose,
}) => {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    tags: "",
    comments: "",
    featured: false,
  });

  const updateMutation = useUpdatePhoto();
  const { data: distinctTags = [] } = usePhotoTags();

  useEffect(() => {
    if (photo) {
      setForm({
        title: photo.title ?? "",
        description: photo.description ?? "",
        category: photo.category ?? "",
        tags: photo.tags ?? "",
        comments: photo.comments ?? "",
        featured: !!photo.featured,
      });
    }
  }, [photo]);

  const handleSave = async () => {
    if (!photo) return;
    await updateMutation.mutateAsync({ id: photo.id, data: form });
    onClose();
  };

  useEffect(() => {
    if (!photo) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, photo]);

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      <motion.div
        className="absolute top-0 right-0 h-full w-full max-w-md bg-card text-card-foreground border-l p-6 overflow-y-auto"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.25 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit Photo</h2>
          <Button variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
            ✕
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              className="mt-1 w-full border border-input bg-background text-foreground rounded px-3 py-2"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              className="mt-1 w-full border border-input bg-background text-foreground rounded px-3 py-2"
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <input
              className="mt-1 w-full border border-input bg-background text-foreground rounded px-3 py-2"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tags
            </label>
            <TagMultiSelect
              value={(form.tags ?? "")
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)}
              options={distinctTags}
              onChange={(vals) =>
                setForm((f) => ({ ...f, tags: vals.join(",") }))
              }
            />
          </div>

          <div>
            <label className="inline-flex items-center space-x-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm((f) => ({ ...f, featured: e.target.checked }))
                }
              />
              <span className="text-sm">Featured</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleSave();
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PhotoEditorDrawer;
