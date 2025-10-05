import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import LocationInput from "../LocationInput";
import type { Photo } from "../../types";
import { formatDateSimple } from "../../utils/dateFormat";
import { selectOptimalImage, ImageUseCase } from "../../utils/imageUtils";

interface PhotoEditFormProps {
  photo: Photo;
  onSave: (updatedPhoto: Partial<Photo>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FormData {
  title: string;
  description: string;
  category: string;
  tags: string;
  comments: string;
  featured: boolean;

  // Location
  location_lat?: number;
  location_lon?: number;
  location_name?: string;
  location_address?: string;
  altitude?: number;

  // Technical metadata
  camera_make?: string;
  camera_model?: string;
  lens?: string;
  iso?: number;
  aperture?: number;
  shutter_speed?: string;
  focal_length?: number;
  date_taken?: string;
  timezone?: string;

  // Custom metadata
  custom_metadata?: Record<string, unknown>;
}

// Define available custom field types
const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes/No" },
  { value: "select", label: "Dropdown" },
  { value: "textarea", label: "Long Text" },
];

const PhotoEditForm: React.FC<PhotoEditFormProps> = ({
  photo,
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const toSafeString = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  };
  const [activeTab, setActiveTab] = useState<
    "basic" | "location" | "technical" | "custom"
  >("basic");
  const [customFields, setCustomFields] = useState<
    Array<{
      key: string;
      type: string;
      label: string;
      value: unknown;
      options?: string[];
    }>
  >([]);
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldLabel, setNewFieldLabel] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      title: photo.title ?? "",
      description: photo.description ?? "",
      category: photo.category ?? "",
      tags: photo.tags ?? "",
      comments: photo.comments ?? "",
      featured: photo.featured ?? false,
      location_lat: photo.location_lat,
      location_lon: photo.location_lon,
      location_name: photo.location_name ?? "",
      location_address: photo.location_address ?? "",
      altitude: photo.altitude,
      camera_make: photo.camera_make ?? "",
      camera_model: photo.camera_model ?? "",
      lens: photo.lens ?? "",
      iso: photo.iso,
      aperture: photo.aperture,
      shutter_speed: photo.shutter_speed ?? "",
      focal_length: photo.focal_length,
      date_taken: photo.date_taken
        ? new Date(photo.date_taken).toISOString().slice(0, 16)
        : "",
      timezone: photo.timezone ?? "",
      custom_metadata: photo.custom_metadata ?? {},
    },
  });

  // Initialize custom fields from photo metadata
  useEffect(() => {
    if (photo.custom_metadata) {
      const fields = Object.entries(photo.custom_metadata).map(
        ([key, value]) => ({
          key,
          type:
            typeof value === "boolean"
              ? "boolean"
              : typeof value === "number"
                ? "number"
                : "text",
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
          value,
        }),
      );
      setCustomFields(fields);
    }
  }, [photo.custom_metadata]);

  const handleLocationChange = (lat: number, lng: number, name?: string) => {
    setValue("location_lat", lat);
    setValue("location_lon", lng);
    if (name) {
      setValue("location_name", name);
    }
  };

  const addCustomField = () => {
    if (!newFieldKey || !newFieldLabel) {
      toast.error("Please enter both key and label for the custom field");
      return;
    }

    if (customFields.some((field) => field.key === newFieldKey)) {
      toast.error("A field with this key already exists");
      return;
    }

    const newField = {
      key: newFieldKey,
      type: newFieldType,
      label: newFieldLabel,
      value:
        newFieldType === "boolean" ? false : newFieldType === "number" ? 0 : "",
    };

    setCustomFields([...customFields, newField]);
    setNewFieldKey("");
    setNewFieldLabel("");
    setNewFieldType("text");
  };

  const updateCustomField = (index: number, value: unknown) => {
    const updatedFields = [...customFields];
    updatedFields[index].value = value;
    setCustomFields(updatedFields);
  };

  const removeCustomField = (index: number) => {
    const updatedFields = customFields.filter((_, i) => i !== index);
    setCustomFields(updatedFields);
  };

  const onSubmit = async (data: FormData) => {
    try {
      // Build metadata object from custom fields
      const metadata = customFields.reduce(
        (acc, field) => {
          acc[field.key] = field.value;
          return acc;
        },
        {} as Record<string, unknown>,
      );

      const updatedPhoto: Partial<Photo> = {
        ...data,
        custom_metadata:
          Object.keys(metadata).length > 0 ? metadata : undefined,
        date_taken: data.date_taken
          ? new Date(data.date_taken).toISOString()
          : undefined,
      };

      await onSave(updatedPhoto);
      toast.success("Photo updated successfully");
    } catch (error) {
      toast.error("Failed to update photo");
      console.error("Error updating photo:", error);
    }
  };

  // Handle form keydown to prevent Enter key from submitting form
  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const renderCustomField = (
    field: (typeof customFields)[0],
    index: number,
  ) => {
    switch (field.type) {
      case "boolean":
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={Boolean(field.value)}
              onChange={(e) => updateCustomField(index, e.target.checked)}
              className="rounded border-input shadow-sm focus:ring-2 focus:ring-primary"
            />
            <span className="ml-2 text-sm">{field.label}</span>
          </label>
        );

      case "number":
        return (
          <div>
            <label className="block text-sm font-medium mb-1">
              {field.label}
            </label>
            <input
              type="number"
              value={toSafeString(field.value)}
              onChange={(e) =>
                updateCustomField(index, parseFloat(e.target.value) || 0)
              }
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>
        );

      case "textarea":
        return (
          <div>
            <label className="block text-sm font-medium mb-1">
              {field.label}
            </label>
            <textarea
              value={toSafeString(field.value)}
              onChange={(e) => updateCustomField(index, e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>
        );

      case "date":
        return (
          <div>
            <label className="block text-sm font-medium mb-1">
              {field.label}
            </label>
            <input
              type="date"
              value={toSafeString(field.value)}
              onChange={(e) => updateCustomField(index, e.target.value)}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>
        );

      default: // text
        return (
          <div>
            <label className="block text-sm font-medium mb-1">
              {field.label}
            </label>
            <input
              type="text"
              value={toSafeString(field.value)}
              onChange={(e) => updateCustomField(index, e.target.value)}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>
        );
    }
  };

  const tabs = [
    { key: "basic", label: "Basic Info", icon: "📝" },
    { key: "location", label: "Location", icon: "📍" },
    { key: "technical", label: "Technical", icon: "📷" },
    { key: "custom", label: "Custom Fields", icon: "⚙️" },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto bg-card rounded-lg shadow-lg overflow-hidden border">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Edit Photo</h2>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="photo-edit-form"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Photo Preview */}
      <div className="px-6 py-4 border-b bg-muted/50">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted">
            {(() => {
              const optimalImage = selectOptimalImage(
                photo,
                ImageUseCase.ADMIN,
              );
              return (
                <img
                  src={optimalImage.url}
                  alt={photo.title}
                  className="w-full h-full object-cover"
                />
              );
            })()}
          </div>
          <div>
            <h3 className="font-medium">{photo.title || "Untitled"}</h3>
            <p className="text-sm text-muted-foreground">
              {photo.width} × {photo.height} •{" "}
              {(photo.file_size / 1024 / 1024).toFixed(1)} MB
            </p>
            <p className="text-sm text-muted-foreground">
              Uploaded {formatDateSimple(photo.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Form Content */}
      <form
        id="photo-edit-form"
        onSubmit={(e) => {
          void handleSubmit(onSubmit)(e);
        }}
        onKeyDown={handleFormKeyDown}
        className="p-6"
      >
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Basic Info Tab */}
          {activeTab === "basic" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    {...register("title", { required: "Title is required" })}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    {...register("category")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Nature, Portrait, Architecture"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  {...register("description")}
                  rows={4}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="Describe this photo..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tags</label>
                <input
                  type="text"
                  {...register("tags")}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="landscape, sunset, mountain (comma-separated)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Comments
                </label>
                <textarea
                  {...register("comments")}
                  rows={3}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="Internal comments or notes..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register("featured")}
                  className="rounded border-input shadow-sm focus:ring-2 focus:ring-primary"
                />
                <label className="ml-2 text-sm">Featured Photo</label>
              </div>
            </div>
          )}

          {/* Location Tab */}
          {activeTab === "location" && (
            <div className="space-y-6">
              <LocationInput
                latitude={watch("location_lat")}
                longitude={watch("location_lon")}
                locationName={watch("location_name")}
                onLocationChange={handleLocationChange}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Full Address
                  </label>
                  <textarea
                    {...register("location_address")}
                    rows={2}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="Complete geocoded address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Altitude (meters)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...register("altitude")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Technical Tab */}
          {activeTab === "technical" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Camera Make
                  </label>
                  <input
                    type="text"
                    {...register("camera_make")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Camera Model
                  </label>
                  <input
                    type="text"
                    {...register("camera_model")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Lens</label>
                  <input
                    type="text"
                    {...register("lens")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">ISO</label>
                  <input
                    type="number"
                    {...register("iso")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Aperture (f-stop)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    {...register("aperture")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Shutter Speed
                  </label>
                  <input
                    type="text"
                    {...register("shutter_speed")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="1/60, 2s, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Focal Length (mm)
                  </label>
                  <input
                    type="number"
                    {...register("focal_length")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Date Taken
                  </label>
                  <input
                    type="datetime-local"
                    {...register("date_taken")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Timezone
                  </label>
                  <input
                    type="text"
                    {...register("timezone")}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="+02:00, PST, etc."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Custom Fields Tab */}
          {activeTab === "custom" && (
            <div className="space-y-6">
              {/* Existing Custom Fields */}
              {customFields.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Custom Fields</h3>
                  <div className="space-y-4">
                    {customFields.map((field, index) => (
                      <div
                        key={field.key}
                        className="border rounded-lg p-4 bg-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{field.label}</h4>
                          <button
                            type="button"
                            onClick={() => removeCustomField(index)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                        {renderCustomField(field, index)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Custom Field */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Add Custom Field</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Field Key
                    </label>
                    <input
                      type="text"
                      value={newFieldKey}
                      onChange={(e) =>
                        setNewFieldKey(
                          e.target.value.toLowerCase().replace(/\s+/g, "_"),
                        )
                      }
                      placeholder="field_name"
                      className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Field Label
                    </label>
                    <input
                      type="text"
                      value={newFieldLabel}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      placeholder="Display Name"
                      className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Field Type
                    </label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                      className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                    >
                      {FIELD_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addCustomField}
                  className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Field
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </form>
    </div>
  );
};

export default PhotoEditForm;
