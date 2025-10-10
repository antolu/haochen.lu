import React from "react";
import { useForm, Controller } from "react-hook-form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export interface PhotoMetadata {
  title: string;
  description: string;
  category: string;
  tags: string;
  comments?: string;
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
    showCategory?: boolean;
    showTags?: boolean;
    showComments?: boolean;
    showFeatured?: boolean;
  };
}

const PhotoMetadataForm: React.FC<PhotoMetadataFormProps> = ({
  defaultValues = {
    title: "",
    description: "",
    category: "",
    tags: "",
    comments: "",
    featured: false,
  },
  onSubmit,
  onCancel,
  submitLabel = "Save",
  isSubmitting = false,
  fields = {
    showTitle: true,
    showDescription: true,
    showCategory: true,
    showTags: true,
    showComments: false,
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

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
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

      {/* Category Field */}
      {fields.showCategory && (
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Landscape</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="street">Street</SelectItem>
                  <SelectItem value="nature">Nature</SelectItem>
                  <SelectItem value="architecture">Architecture</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="macro">Macro</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Tags Field */}
      {fields.showTags && (
        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            type="text"
            {...register("tags")}
            placeholder="landscape, sunset, mountain (comma-separated)"
          />
          <p className="text-xs text-muted-foreground">
            Separate tags with commas
          </p>
        </div>
      )}

      {/* Comments Field */}
      {fields.showComments && (
        <div className="space-y-2">
          <Label htmlFor="comments">Comments</Label>
          <Textarea
            id="comments"
            {...register("comments")}
            rows={2}
            placeholder="Additional comments or notes..."
          />
        </div>
      )}

      {/* Featured Checkbox */}
      {fields.showFeatured && (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="featured"
            {...register("featured")}
            className="w-4 h-4 text-blue-600 bg-muted border-input rounded focus:ring-ring focus:ring-2"
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
