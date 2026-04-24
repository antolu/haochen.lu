import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { motion } from "framer-motion";
import type { Photo } from "../../types";
import { useUpdatePhoto, usePhotoTags } from "../../hooks/usePhotos";
import TagMultiSelect from "./TagMultiSelect";
import { formatDateTime } from "../../utils/dateFormat";
import { selectOptimalImage, ImageUseCase } from "../../utils/imageUtils";
import { Button } from "../ui/button";
import { Trash2, Star, X, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { useCameraAliases } from "../../hooks/useCameraAliases";
import { useLensAliases } from "../../hooks/useLensAliases";
// Remove direct import of MapPicker and lazy-load it instead
const LazyMapPicker = lazy(() => import("../MapPicker"));

interface PhotoFormData {
  title: string;
  description: string;
  tags: string;
  featured: boolean;
  location_lat?: number;
  location_lon?: number;
  location_name: string;
  location_address: string;
  // Technical
  camera_make?: string;
  camera_model?: string;
  lens?: string;
  iso?: number;
  aperture?: number;
  shutter_speed?: string;
  focal_length?: number;
  date_taken?: string;
}

interface PhotoFormProps {
  photo: Photo;
  onSuccess?: (updated: Photo) => void;
  onCancel?: () => void;
  onDelete?: (photo: Photo) => void;
  onToggleFeatured?: (photo: Photo) => void;
}

const PhotoForm: React.FC<PhotoFormProps> = ({
  photo,
  onSuccess,
  onCancel,
  onDelete,
  onToggleFeatured,
}) => {
  const updateMutation = useUpdatePhoto();
  const { data: distinctTags = [] } = usePhotoTags();

  const [form, setForm] = useState<PhotoFormData>({
    title: photo.title ?? "",
    description: photo.description ?? "",
    tags: photo.tags ?? "",
    featured: !!photo.featured,
    // Location
    location_lat:
      typeof photo.location_lat === "number" ? photo.location_lat : undefined,
    location_lon:
      typeof photo.location_lon === "number" ? photo.location_lon : undefined,
    location_name: photo.location_name ?? "",
    location_address: photo.location_address ?? "",
    // Technical
    camera_make: photo.camera_make ?? "",
    camera_model: photo.camera_model ?? "",
    lens: photo.lens ?? "",
    iso: photo.iso ?? undefined,
    aperture: photo.aperture ?? undefined,
    shutter_speed: photo.shutter_speed ?? "",
    focal_length: photo.focal_length ?? undefined,
    date_taken: photo.date_taken ?? "",
  });

  const { data: cameraAliasesData } = useCameraAliases({ per_page: 100 });
  const { data: lensAliasesData } = useLensAliases({ per_page: 100 });
  const cameraAliases = cameraAliasesData?.aliases ?? [];
  const lensAliases = lensAliasesData?.aliases ?? [];

  useEffect(() => {
    // Only reset form if the photo ID has changed to prevent flickers during refetches
    const timer = setTimeout(() => {
      setForm({
        title: photo.title ?? "",
        description: photo.description ?? "",
        tags: photo.tags ?? "",
        featured: !!photo.featured,
        // Location
        location_lat:
          typeof photo.location_lat === "number"
            ? photo.location_lat
            : undefined,
        location_lon:
          typeof photo.location_lon === "number"
            ? photo.location_lon
            : undefined,
        location_name: photo.location_name ?? "",
        location_address: photo.location_address ?? "",
        // Technical
        camera_make: photo.camera_make ?? "",
        camera_model: photo.camera_model ?? "",
        lens: photo.lens ?? "",
        iso: photo.iso ?? undefined,
        aperture: photo.aperture ?? undefined,
        shutter_speed: photo.shutter_speed ?? "",
        focal_length: photo.focal_length ?? undefined,
        date_taken: photo.date_taken ?? "",
      });
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id]); // ONLY change on ID, not identity

  const isSaving = updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await updateMutation.mutateAsync({
      id: photo.id,
      data: form,
    });
    onSuccess?.(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
    }
  };

  // Reverse geocode when coordinates change (debounced)
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doReverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const resp = await fetch(
        `/api/locations/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      );
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        location_name?: string;
        location_address?: string;
      };
      setForm((f) => ({
        ...f,
        location_name: data.location_name ?? "",
        location_address: data.location_address ?? "",
      }));
    } catch {
      // ignore; keep coordinates
    }
  }, []);

  useEffect(() => {
    if (
      typeof form.location_lat !== "number" ||
      typeof form.location_lon !== "number"
    )
      return;
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(() => {
      void doReverseGeocode(
        form.location_lat as number,
        form.location_lon as number,
      );
    }, 400);
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    };
  }, [form.location_lat, form.location_lon, doReverseGeocode]);

  const handleMapSelect = (lat: number, lng: number) => {
    setForm((f) => ({ ...f, location_lat: lat, location_lon: lng }));
  };

  const parseNumber = (val: string) => {
    const n = parseFloat(val);
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <motion.div
      className="max-w-6xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        onKeyDown={handleKeyDown}
        className="space-y-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Edit Photo</h2>
            <p className="text-muted-foreground mt-2">
              Update photo metadata and location settings
            </p>
          </div>
          <div className="flex gap-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onCancel}
                className="rounded-full px-8"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              disabled={isSaving}
              className="rounded-full px-8 shadow-lg shadow-primary/20"
            >
              <Check className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Preview Panel */}
          <div className="md:col-span-1">
            <div className="bg-card p-4 rounded-xl border-border/40 shadow-lg sticky top-6">
              <div className="aspect-square w-full overflow-hidden rounded-md bg-muted group cursor-zoom-in relative">
                {/* Prefer a medium/large variant, fallback to original */}
                {(() => {
                  const optimalImage = selectOptimalImage(
                    photo,
                    ImageUseCase.ADMIN,
                  );
                  return (
                    <img
                      src={optimalImage.url}
                      alt={photo.title ?? "Photo preview"}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  );
                })()}
                {/* Click to open full image in new tab */}
                <a
                  href={
                    photo.variants?.xlarge?.url ??
                    photo.variants?.large?.url ??
                    photo.original_url
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0"
                  aria-label="Open full image"
                />
              </div>
              <div className="mt-4 text-xs text-muted-foreground space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-foreground/70 uppercase tracking-tight text-[10px]">
                    Filename
                  </span>
                  <span
                    className="truncate max-w-[150px]"
                    title={photo.filename}
                  >
                    {photo.filename}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground/70 uppercase tracking-tight text-[10px]">
                    Dimensions
                  </span>
                  <span>
                    {photo.width} × {photo.height}
                  </span>
                </div>
                {photo.date_taken && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground/70 uppercase tracking-tight text-[10px]">
                      Captured
                    </span>
                    <span>{formatDateTime(photo.date_taken)}</span>
                  </div>
                )}

                {/* Technical Info Grid (Read-only) */}
                <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-y-2 gap-x-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground/70 uppercase tracking-tight text-[10px] mb-0.5">
                      ISO
                    </span>
                    <span className="text-sm font-medium">
                      {form.iso ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground/70 uppercase tracking-tight text-[10px] mb-0.5">
                      Aperture
                    </span>
                    <span className="text-sm font-medium">
                      {form.aperture ? `ƒ/${form.aperture}` : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground/70 uppercase tracking-tight text-[10px] mb-0.5">
                      Shutter
                    </span>
                    <span className="text-sm font-medium">
                      {form.shutter_speed ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground/70 uppercase tracking-tight text-[10px] mb-0.5">
                      Focal Length
                    </span>
                    <span className="text-sm font-medium">
                      {form.focal_length ? `${form.focal_length}mm` : "—"}
                    </span>
                  </div>
                </div>

                {/* Equipment Selection (Editable) */}
                <div className="pt-2 border-t border-border/40 space-y-3">
                  <div>
                    <label className="font-semibold text-foreground/70 uppercase tracking-tight text-[10px] mb-1.5 block">
                      Camera
                    </label>
                    <select
                      className="w-full bg-muted/20 border border-border/40 rounded-lg px-2 py-1.5 text-[13px] focus:ring-1 focus:ring-primary outline-none transition-all"
                      value={`${form.camera_make}|${form.camera_model}`}
                      onChange={(e) => {
                        const [make, model] = e.target.value.split("|");
                        setForm((f) => ({
                          ...f,
                          camera_make: make,
                          camera_model: model,
                        }));
                      }}
                    >
                      <option value="|">Select camera...</option>
                      {cameraAliases.map((alias) => (
                        <option
                          key={alias.id}
                          value={`${alias.brand}|${alias.model}`}
                        >
                          {alias.display_name}
                        </option>
                      ))}
                      {form.camera_make &&
                        !cameraAliases.find(
                          (a) =>
                            a.brand === form.camera_make &&
                            a.model === form.camera_model,
                        ) && (
                          <option
                            value={`${form.camera_make}|${form.camera_model}`}
                          >
                            {form.camera_make} {form.camera_model}
                          </option>
                        )}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground/70 uppercase tracking-tight text-[10px] mb-1.5 block">
                      Lens
                    </label>
                    <select
                      className="w-full bg-muted/20 border border-border/40 rounded-lg px-2 py-1.5 text-[13px] focus:ring-1 focus:ring-primary outline-none transition-all"
                      value={form.lens}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lens: e.target.value }))
                      }
                    >
                      <option value="">Select lens...</option>
                      {lensAliases.map((alias) => (
                        <option key={alias.id} value={alias.original_name}>
                          {alias.display_name}
                        </option>
                      ))}
                      {form.lens &&
                        !lensAliases.find(
                          (a) => a.original_name === form.lens,
                        ) && <option value={form.lens}>{form.lens}</option>}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="md:col-span-2">
            <div className="bg-card p-8 rounded-xl border-border/40 shadow-lg space-y-8">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Title
                </label>
                <input
                  className="mt-1 w-full border-2 border-border/50 bg-background text-foreground rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Description
                </label>
                <textarea
                  className="mt-1 w-full border-2 border-border/50 bg-background text-foreground rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y"
                  rows={6}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Tags</label>
                <TagMultiSelect
                  value={(form.tags ?? "")
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)}
                  options={distinctTags}
                  onChange={(vals) =>
                    setForm((f) => ({ ...f, tags: vals.join(",") }))
                  }
                  placeholder="Search or create tags..."
                />
              </div>

              {/* Location Section */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Location</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground underline"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          location_lat: undefined,
                          location_lon: undefined,
                          location_name: "",
                          location_address: "",
                        }))
                      }
                    >
                      Clear
                    </button>
                    {typeof photo.location_lat === "number" &&
                      typeof photo.location_lon === "number" && (
                        <button
                          type="button"
                          className="text-sm text-muted-foreground hover:text-foreground underline"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              location_lat: photo.location_lat,
                              location_lon: photo.location_lon,
                            }))
                          }
                        >
                          Reset to EXIF
                        </button>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Suspense
                    fallback={
                      <div className="h-[320px] w-full rounded-lg border bg-muted flex items-center justify-center text-muted-foreground">
                        Loading map...
                      </div>
                    }
                  >
                    <LazyMapPicker
                      latitude={
                        typeof form.location_lat === "number"
                          ? form.location_lat
                          : 37.7749
                      }
                      longitude={
                        typeof form.location_lon === "number"
                          ? form.location_lon
                          : -122.4194
                      }
                      zoom={13}
                      height={320}
                      onLocationSelect={handleMapSelect}
                      onLocationChange={handleMapSelect}
                      showSearch
                    />
                  </Suspense>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium">
                        Latitude
                      </label>
                      <input
                        className="mt-1 w-full border border-input bg-background text-foreground rounded px-3 py-2"
                        inputMode="decimal"
                        value={
                          typeof form.location_lat === "number"
                            ? String(form.location_lat)
                            : ""
                        }
                        placeholder="e.g., 37.7749"
                        onChange={(e) => {
                          const v = parseNumber(e.target.value);
                          setForm((f) => ({ ...f, location_lat: v }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">
                        Longitude
                      </label>
                      <input
                        className="mt-1 w-full border border-input bg-background text-foreground rounded px-3 py-2"
                        inputMode="decimal"
                        value={
                          typeof form.location_lon === "number"
                            ? String(form.location_lon)
                            : ""
                        }
                        placeholder="e.g., -122.4194"
                        onChange={(e) => {
                          const v = parseNumber(e.target.value);
                          setForm((f) => ({ ...f, location_lon: v }));
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium">
                        Location Name
                      </label>
                      <input
                        className="mt-1 w-full border border-input bg-background text-foreground rounded px-3 py-2"
                        value={form.location_name}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            location_name: e.target.value,
                          }))
                        }
                        placeholder="City, State, Country"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">
                        Address
                      </label>
                      <input
                        className="mt-1 w-full border border-input bg-background text-foreground rounded px-3 py-2"
                        value={form.location_address}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            location_address: e.target.value,
                          }))
                        }
                        placeholder="Full address"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Form Actions */}
            <div className="flex items-center justify-between pt-6 border-t mt-8">
              <div className="flex gap-3">
                {onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={() => onDelete(photo)}
                    className="text-destructive hover:bg-destructive/10 rounded-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Photo
                  </Button>
                )}
                {onToggleFeatured && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={() => onToggleFeatured(photo)}
                    className={cn(
                      "rounded-full hover:bg-yellow-500/10",
                      photo.featured &&
                        "text-yellow-600 dark:text-yellow-500 bg-yellow-500/5 hover:bg-yellow-500/20",
                    )}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4 mr-2",
                        photo.featured && "fill-current",
                      )}
                    />
                    {photo.featured ? "Featured" : "Mark Featured"}
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  type="button"
                  onClick={onCancel}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  size="lg"
                  type="submit"
                  disabled={isSaving}
                  className="rounded-full px-12 shadow-md"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );
};

export default PhotoForm;
