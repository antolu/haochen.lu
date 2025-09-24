import React from "react";
import { useForm } from "react-hook-form";

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
    formState: { errors },
  } = useForm<PhotoMetadata>({
    defaultValues,
    mode: "onBlur",
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Title Field */}
      {fields.showTitle && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register("title", {
              required: "Title is required",
              minLength: { value: 1, message: "Title cannot be empty" },
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter photo title..."
          />
          {errors.title && (
            <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
          )}
        </div>
      )}

      {/* Description Field */}
      {fields.showDescription && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            {...register("description")}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
            placeholder="Describe your photo..."
          />
        </div>
      )}

      {/* Category Field */}
      {fields.showCategory && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            {...register("category")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select category...</option>
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
            <option value="street">Street</option>
            <option value="nature">Nature</option>
            <option value="architecture">Architecture</option>
            <option value="travel">Travel</option>
            <option value="macro">Macro</option>
            <option value="event">Event</option>
            <option value="other">Other</option>
          </select>
        </div>
      )}

      {/* Tags Field */}
      {fields.showTags && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <input
            type="text"
            {...register("tags")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="landscape, sunset, mountain (comma-separated)"
          />
          <p className="text-xs text-gray-500 mt-1">
            Separate tags with commas
          </p>
        </div>
      )}

      {/* Comments Field */}
      {fields.showComments && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comments
          </label>
          <textarea
            {...register("comments")}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
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
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          />
          <label
            htmlFor="featured"
            className="text-sm font-medium text-gray-700"
          >
            Mark as featured photo
          </label>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default PhotoMetadataForm;
