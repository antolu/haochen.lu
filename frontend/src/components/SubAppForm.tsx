import React from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import type { SubApp } from "../types";

interface SubAppFormData {
  name: string;
  url: string;
  description?: string;
  icon?: string;
  color?: string;
  is_external: boolean;
  requires_auth: boolean;
  admin_only: boolean;
  show_in_menu: boolean;
  enabled: boolean;
  order: number;
}

interface SubAppFormProps {
  subapp?: SubApp;
  onSubmit: (data: SubAppFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const SubAppForm: React.FC<SubAppFormProps> = ({
  subapp,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const isEditing = !!subapp;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SubAppFormData>({
    defaultValues: {
      name: subapp?.name ?? "",
      url: subapp?.url ?? "",
      description: subapp?.description ?? "",
      icon: subapp?.icon ?? "",
      color: subapp?.color ?? "#3B82F6",
      is_external: subapp?.is_external ?? true,
      requires_auth: subapp?.requires_auth ?? false,
      admin_only: subapp?.admin_only ?? false,
      show_in_menu: subapp?.show_in_menu ?? true,
      enabled: subapp?.enabled ?? true,
      order: subapp?.order ?? 0,
    },
  });

  const watchUrl = watch("url");
  const watchColor = watch("color");

  const validateUrl = (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return "Please enter a valid URL (e.g., https://example.com)";
    }
  };

  const handleFormSubmit = async (data: SubAppFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <form
        onSubmit={(e) => {
          void handleSubmit(handleFormSubmit)(e);
        }}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name Field */}
          <div className="md:col-span-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground mb-2"
            >
              App Name *
            </label>
            <input
              id="name"
              type="text"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-300" : "border-gray-300"
              }`}
              placeholder="My Awesome App"
              {...register("name", {
                required: "App name is required",
                minLength: {
                  value: 2,
                  message: "Name must be at least 2 characters",
                },
              })}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* URL Field */}
          <div className="md:col-span-2">
            <label
              htmlFor="url"
              className="block text-sm font-medium text-foreground mb-2"
            >
              URL *
            </label>
            <input
              id="url"
              type="url"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.url ? "border-red-300" : "border-gray-300"
              }`}
              placeholder="https://example.com/app"
              {...register("url", {
                required: "URL is required",
                validate: validateUrl,
              })}
            />
            {errors.url && (
              <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
            )}
            {watchUrl && !errors.url && (
              <p className="mt-1 text-sm text-gray-500">
                Preview:{" "}
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {watchUrl}
                </a>
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="md:col-span-2">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of the sub-application"
              {...register("description")}
            />
          </div>

          {/* Icon Field */}
          <div>
            <label
              htmlFor="icon"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Icon (URL or emoji)
            </label>
            <input
              id="icon"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="🚀 or https://example.com/icon.svg"
              {...register("icon")}
            />
          </div>

          {/* Color Field */}
          <div>
            <label
              htmlFor="color"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Theme Color
            </label>
            <div className="flex items-center space-x-3">
              <input
                id="color"
                type="color"
                className="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
                {...register("color")}
              />
              <div
                className="h-10 w-10 rounded-lg border border-gray-300"
                style={{ backgroundColor: watchColor }}
              />
              <span className="text-sm text-gray-500">{watchColor}</span>
            </div>
          </div>

          {/* Order Field */}
          <div>
            <label
              htmlFor="order"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Display Order
            </label>
            <input
              id="order"
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
              {...register("order", {
                valueAsNumber: true,
                min: { value: 0, message: "Order must be 0 or greater" },
              })}
            />
            {errors.order && (
              <p className="mt-1 text-sm text-red-600">
                {errors.order.message}
              </p>
            )}
          </div>
        </div>

        {/* Settings Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* External App Toggle */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                {...register("is_external")}
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  External Application
                </span>
                <p className="text-xs text-gray-500">Opens in new tab/window</p>
              </div>
            </label>

            {/* Auth Required Toggle */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                {...register("requires_auth")}
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  Requires Authentication
                </span>
                <p className="text-xs text-gray-500">User must be logged in</p>
              </div>
            </label>

            {/* Admin Only Toggle */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                {...register("admin_only")}
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  Admin Only
                </span>
                <p className="text-xs text-gray-500">Only admins can access</p>
              </div>
            </label>

            {/* Show in Menu Toggle */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                {...register("show_in_menu")}
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  Show in Menu
                </span>
                <p className="text-xs text-gray-500">Display in navigation</p>
              </div>
            </label>

            {/* Enabled Toggle */}
            <label className="flex items-center space-x-3 cursor-pointer md:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                {...register("enabled")}
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  Enabled
                </span>
                <p className="text-xs text-gray-500">
                  App is active and accessible
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                {isEditing ? "Updating..." : "Creating..."}
              </div>
            ) : isEditing ? (
              "Update Sub-App"
            ) : (
              "Create Sub-App"
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default SubAppForm;
