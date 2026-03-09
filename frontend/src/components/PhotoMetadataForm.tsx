import React from "react";
import { useForm, Controller } from "react-hook-form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import TagMultiSelect from "./admin/TagMultiSelect";
import { usePhotoTags } from "../hooks/usePhotos";

export interface PhotoMetadata {
  title: string;
  description: string;
  tags: string;
  featured: boolean;
}

interface PhotoMetadataFormProps {
  defaultValues?: Partial<PhotoMetadata>;
  onSubmit: (metadata: PhotoMetadata) => void;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  fields?: {
    showTitle?: boolean;
    showDescription?: boolean;
    showTags?: boolean;
    showFeatured?: boolean;
  };
}

const PhotoMetadataForm: React.FC<PhotoMetadataFormProps> = ({
  defaultValues = {
    title: "",
    description: "",
    tags: "",
    featured: false,
  },
  onSubmit,
  onCancel,
  submitLabel = "Save",
  isSubmitting = false,
  fields = {
    showTitle: true,
    showDescription: true,
    showTags: true,
    showFeatured: true,
  },
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PhotoMetadata>({
    defaultValues,
    mode: "onBlur",
  });

  const { data: distinctTags = [] } = usePhotoTags();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      onKeyDown={handleKeyDown}
      className="space-y-4"
    >
      {/* Title Field */}
      {fields.showTitle && (
        <div className="space-y-2">
          <Label htmlFor="title">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            type="text"
            {...register("title", {
              required: "Title is required",
              minLength: { value: 1, message: "Title cannot be empty" },
            })}
            placeholder="Enter photo title..."
          />
          {errors.title && (
            <p className="text-destructive text-sm">{errors.title.message}</p>
          )}
        </div>
      )}

      {/* Description Field */}
      {fields.showDescription && (
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register("description")}
            rows={3}
            placeholder="Describe your photo..."
          />
        </div>
      )}

      {/* Tags Field */}
      {fields.showTags && (
        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <TagMultiSelect
                value={
                  typeof field.value === "string"
                    ? field.value.split(",").filter(Boolean)
                    : []
                }
                options={distinctTags}
                onChange={(values: string[]) =>
                  field.onChange(values.join(","))
                }
                onBlur={field.onBlur}
                name={field.name}
                placeholder="Add tags... (Enter, Comma, or Space)"
              />
            )}
          />
          <p className="text-xs text-muted-foreground">
            Press Enter, Comma, or Space to create a tag
          </p>
        </div>
      )}

      {/* Featured Checkbox */}
      {fields.showFeatured && (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="featured"
            {...register("featured")}
            className="w-4 h-4 text-primary bg-muted border-input rounded focus:ring-primary focus:ring-2 accent-primary transition-colors"
          />
          <label
            htmlFor="featured"
            className="text-sm font-medium text-foreground"
          >
            Mark as featured photo
          </label>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default PhotoMetadataForm;
