import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  useUpdateCameraAlias,
  type CameraAlias,
  type CameraAliasUpdate,
} from "../hooks/useCameraAliases";
import {
  useUpdateLensAlias,
  type LensAlias,
  type LensAliasUpdate,
} from "../hooks/useLensAliases";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Switch } from "./ui/switch";
import { Camera, Settings, AlertCircle } from "lucide-react";

type EquipmentType = "cameras" | "lenses";
type AliasType = CameraAlias | LensAlias;

interface EquipmentAliasFormProps {
  alias: AliasType | null;
  type: EquipmentType;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: "text" | "select";
  options?: string[];
  description?: string;
}

const EquipmentAliasForm: React.FC<EquipmentAliasFormProps> = ({
  alias,
  type,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Record<string, string | boolean>>(
    {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cameraUpdateMutation = useUpdateCameraAlias();
  const lensUpdateMutation = useUpdateLensAlias();

  // Field configurations based on equipment type
  const fieldConfigs: Record<EquipmentType, FormField[]> = {
    cameras: [
      {
        key: "original_name",
        label: "Original Name",
        placeholder: "e.g., SONY ILCE-7RM3",
        required: true,
        description: "The exact camera name as it appears in photo EXIF data",
      },
      {
        key: "display_name",
        label: "Display Name",
        placeholder: "e.g., Sony A7 RIII",
        required: true,
        description: "User-friendly name to display instead of the original",
      },
      {
        key: "brand",
        label: "Brand",
        placeholder: "e.g., Sony",
      },
      {
        key: "model",
        label: "Model",
        placeholder: "e.g., A7 RIII",
      },
      {
        key: "notes",
        label: "Notes",
        placeholder: "Optional notes about this camera...",
      },
    ],
    lenses: [
      {
        key: "original_name",
        label: "Original Name",
        placeholder: "e.g., FE 24-70mm F2.8 GM",
        required: true,
        description: "The exact lens name as it appears in photo EXIF data",
      },
      {
        key: "display_name",
        label: "Display Name",
        placeholder: "e.g., Sony FE 24-70mm f/2.8 GM",
        required: true,
        description: "User-friendly name to display instead of the original",
      },
      {
        key: "brand",
        label: "Brand",
        placeholder: "e.g., Sony",
      },
      {
        key: "model",
        label: "Model",
        placeholder: "e.g., FE 24-70mm f/2.8 GM",
      },
      {
        key: "mount_type",
        label: "Mount Type",
        placeholder: "e.g., Sony E-mount",
      },
      {
        key: "focal_length",
        label: "Focal Length",
        placeholder: "e.g., 24-70mm",
      },
      {
        key: "max_aperture",
        label: "Max Aperture",
        placeholder: "e.g., f/2.8",
      },
      {
        key: "lens_type",
        label: "Lens Type",
        type: "select",
        options: [
          "",
          "Prime",
          "Zoom",
          "Macro",
          "Fisheye",
          "Telephoto",
          "Wide Angle",
          "Standard",
        ],
        placeholder: "Select lens type...",
      },
      {
        key: "notes",
        label: "Notes",
        placeholder: "Optional notes about this lens...",
      },
    ],
  };

  const currentFields = fieldConfigs[type];

  // Initialize form data when alias changes
  useEffect(() => {
    if (alias) {
      const initialData: Record<string, string | boolean> = { is_active: true };

      currentFields.forEach((field) => {
        const value = (alias as unknown as Record<string, unknown>)[field.key];
        initialData[field.key] = (value as string) ?? "";
      });

      initialData.is_active = alias.is_active ?? true;
      setFormData(initialData);
    }
  }, [alias, currentFields]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    currentFields.forEach((field) => {
      if (field.required) {
        const value = formData[field.key] as string;
        if (!value?.toString().trim()) {
          newErrors[field.key] = `${field.label} is required`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !alias?.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare submit data
      const submitData: Record<string, string | boolean | undefined> = {};

      currentFields.forEach((field) => {
        const value = formData[field.key] as string;
        submitData[field.key] = value?.trim() || undefined;
      });

      submitData.is_active = formData.is_active;

      // Submit based on type
      if (type === "cameras") {
        await cameraUpdateMutation.mutateAsync({
          id: alias.id,
          data: submitData as CameraAliasUpdate,
        });
      } else {
        await lensUpdateMutation.mutateAsync({
          id: alias.id,
          data: submitData as LensAliasUpdate,
        });
      }

      onSuccess();
    } catch (error: unknown) {
      console.error(`Failed to save ${type} alias:`, error);

      // Handle validation errors from the server
      const errorResponse = error as {
        response?: {
          data?: { detail?: string | Array<{ loc?: string[]; msg?: string }> };
        };
      };
      if (errorResponse.response?.data?.detail) {
        if (typeof errorResponse.response.data.detail === "string") {
          setErrors({ submit: errorResponse.response.data.detail });
        } else if (Array.isArray(errorResponse.response.data.detail)) {
          const newErrors: Record<string, string> = {};
          errorResponse.response.data.detail.forEach((err) => {
            if (err.loc && err.msg) {
              const field = err.loc[err.loc.length - 1];
              newErrors[field] = err.msg;
            }
          });
          setErrors(newErrors);
        }
      } else {
        setErrors({
          submit: "An unexpected error occurred. Please try again.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const Icon = type === "cameras" ? Camera : Settings;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">
            Edit {type === "cameras" ? "Camera" : "Lens"} Alias
          </h3>
          <p className="text-sm text-muted-foreground">
            Update the display information for this{" "}
            {type === "cameras" ? "camera" : "lens"}
          </p>
        </div>
        <Badge variant="outline" className="ml-auto">
          {alias?.original_name}
        </Badge>
      </div>

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="space-y-6"
      >
        {/* Error display */}
        {errors.submit && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{errors.submit}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentFields.map((field) => (
            <div
              key={field.key}
              className={field.key === "notes" ? "md:col-span-2" : ""}
            >
              <label className="block text-sm font-medium mb-2">
                {field.label}
                {field.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </label>

              {field.type === "select" ? (
                <select
                  value={formData[field.key] as string}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  className={`w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                    errors[field.key] ? "border-destructive" : ""
                  }`}
                >
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option || field.placeholder}
                    </option>
                  ))}
                </select>
              ) : field.key === "notes" ? (
                <textarea
                  value={formData[field.key] as string}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className={`w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                    errors[field.key] ? "border-destructive" : ""
                  }`}
                />
              ) : (
                <Input
                  value={formData[field.key] as string}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={errors[field.key] ? "border-destructive" : ""}
                />
              )}

              {errors[field.key] && (
                <p className="mt-1 text-sm text-destructive">
                  {errors[field.key]}
                </p>
              )}

              {field.description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {field.description}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Active Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Status</label>
                <p className="text-xs text-muted-foreground">
                  Aliases are only applied when active
                </p>
              </div>
              <Switch
                checked={formData.is_active as boolean}
                onCheckedChange={(checked) =>
                  handleInputChange("is_active", checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="min-w-24">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
};

export default EquipmentAliasForm;
