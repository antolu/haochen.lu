import React from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import type { Application } from "../types";

interface AppFormData {
  name: string;
  url: string;
  admin_url?: string;
  description?: string;
  icon?: string;
  color?: string;
  is_external: boolean;
  requires_auth: boolean;
  admin_only: boolean;
  enabled: boolean;
  redirect_uris?: string;
}

interface AppFormProps {
  application?: Application;
  onSubmit: (data: AppFormData) => Promise<void>;
  onCancel: () => void;
  onRegenerateCredentials?: () => void;
  isLoading?: boolean;
}

const AppForm: React.FC<AppFormProps> = ({
  application,
  onSubmit,
  onCancel,
  onRegenerateCredentials,
  isLoading = false,
}) => {
  const isEditing = !!application;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AppFormData>({
    defaultValues: {
      name: application?.name ?? "",
      url: application?.url ?? "",
      admin_url: application?.admin_url ?? "",
      description: application?.description ?? "",
      icon: application?.icon ?? "",
      color: application?.color ?? "#3B82F6",
      is_external: application?.is_external ?? true,
      requires_auth: application?.requires_auth ?? false,
      admin_only: application?.admin_only ?? false,
      enabled: application?.enabled ?? true,
      redirect_uris: application?.redirect_uris ?? "",
    },
  });

  const watchUrl = watch("url");
  const watchColor = watch("color");
  const watchRequiresAuth = watch("requires_auth");

  const validateUrl = (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return "Please enter a valid URL (e.g., https://example.com)";
    }
  };

  const handleFormSubmit = async (data: AppFormData) => {
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
              className={`w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-300" : "border-border"
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
              className={`w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.url ? "border-red-300" : "border-border"
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
              <p className="mt-1 text-sm text-muted-foreground">
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

          <div className="md:col-span-2">
            <label
              htmlFor="admin_url"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Admin URL
            </label>
            <input
              id="admin_url"
              type="url"
              className={`w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.admin_url ? "border-red-300" : "border-border"
              }`}
              placeholder="https://example.com/admin"
              {...register("admin_url", {
                validate: (value) => {
                  if (!value) {
                    return true;
                  }
                  return validateUrl(value);
                },
              })}
            />
            {errors.admin_url && (
              <p className="mt-1 text-sm text-red-600">
                {errors.admin_url.message}
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
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of the application"
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
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="h-10 w-20 border border-border rounded-lg cursor-pointer"
                {...register("color")}
              />
              <div
                className="h-10 w-10 rounded-lg border border-border"
                style={{ backgroundColor: watchColor }}
              />
              <span className="text-sm text-muted-foreground">
                {watchColor}
              </span>
            </div>
          </div>
        </div>

        {/* Settings Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-foreground mb-4">Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* External App Toggle */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                {...register("is_external")}
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  External Application
                </span>
                <p className="text-xs text-muted-foreground">
                  Opens in new tab/window
                </p>
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
                <span className="text-sm font-medium text-foreground">
                  Requires Authentication
                </span>
                <p className="text-xs text-muted-foreground">
                  User must be logged in
                </p>
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
                <span className="text-sm font-medium text-foreground">
                  Admin Only
                </span>
                <p className="text-xs text-muted-foreground">
                  Only admins can access
                </p>
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
                <span className="text-sm font-medium text-foreground">
                  Enabled
                </span>
                <p className="text-xs text-muted-foreground">
                  App is active and accessible
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* OIDC Section */}
        {watchRequiresAuth && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-foreground mb-1">
              OIDC Integration
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              These credentials are used to register this app with Authelia.
              Client ID and secret are auto-generated on creation.
            </p>
            <div className="space-y-4">
              {isEditing && application?.client_id && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Client ID
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={application.client_id}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-foreground font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              application.client_id ?? "",
                            );
                          }}
                          className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
                          title="Copy"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Client Secret
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={application.client_secret ?? ""}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-foreground font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              application.client_secret ?? "",
                            );
                          }}
                          className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
                          title="Copy"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                  {onRegenerateCredentials && (
                    <button
                      type="button"
                      onClick={onRegenerateCredentials}
                      className="text-xs text-amber-600 hover:text-amber-700 underline underline-offset-2 transition-colors"
                    >
                      Regenerate client ID &amp; secret
                    </button>
                  )}
                </div>
              )}
              {!isEditing && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  Client ID and secret will be generated automatically when the
                  app is created.
                </p>
              )}
              <div>
                <label
                  htmlFor="redirect_uris"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Redirect URIs
                </label>
                <textarea
                  id="redirect_uris"
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://yourapp.example.com/auth/callback"
                  {...register("redirect_uris")}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  One URI per line. Used by Authelia to validate OAuth
                  callbacks.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
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
              "Update Application"
            ) : (
              "Create Application"
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default AppForm;
