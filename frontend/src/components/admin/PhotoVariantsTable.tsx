import { useState } from "react";
import { Check, X, RefreshCcw, Loader2, AlertTriangle } from "lucide-react";
import type { Photo, ImageVariant, MultiFormatVariants } from "../../types";
import { formatFileSize } from "../../utils/photoUtils";
import { useRegenerateVariants } from "../../hooks/usePhotos";
import { cn } from "../../lib/utils";

const SIZES = [
  "micro",
  "thumbnail",
  "small",
  "medium",
  "large",
  "xlarge",
] as const;

const FORMATS = ["webp", "jpeg", "avif"] as const;

interface PhotoVariantsTableProps {
  photo: Photo;
}

const isImageVariant = (value: unknown): value is ImageVariant =>
  !!value && typeof value === "object" && "size_bytes" in value;

const getVariant = (
  variants: Photo["variants"],
  size: string,
  format: "avif" | "webp" | "jpeg",
): ImageVariant | undefined => {
  const sizeData = variants?.[size];
  if (!sizeData) return undefined;
  const formatData = (sizeData as MultiFormatVariants)[format];
  return isImageVariant(formatData) ? formatData : undefined;
};

export default function PhotoVariantsTable({ photo }: PhotoVariantsTableProps) {
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const regenerateVariants = useRegenerateVariants();

  const handleRegenerate = (size: string, format: string) => {
    const cellKey = `${size}-${format}`;
    setPendingCell(cellKey);
    regenerateVariants.mutate(
      { id: photo.id, size, format },
      {
        onSettled: () => setPendingCell(null),
      },
    );
  };

  return (
    <div className="pt-2 border-t border-border/40 space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-foreground/70 uppercase tracking-tight text-[10px]">
          Variants
        </span>
        <span className="text-xs text-muted-foreground">
          Original: {formatFileSize(photo.file_size)}
        </span>
      </div>

      {photo.processing_errors && photo.processing_errors.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <ul className="space-y-0.5">
            {photo.processing_errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr>
              <th className="text-left font-semibold text-foreground/70 uppercase tracking-tight text-[10px] py-1 pr-2">
                Size
              </th>
              {FORMATS.map((format) => (
                <th
                  key={format}
                  className="text-center font-semibold text-foreground/70 uppercase tracking-tight text-[10px] py-1 px-1"
                >
                  {format}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZES.map((size) => (
              <tr key={size} className="border-t border-border/20">
                <td className="py-1 pr-2 font-medium capitalize">{size}</td>
                {FORMATS.map((format) => {
                  const cellKey = `${size}-${format}`;
                  const variant = getVariant(photo.variants, size, format);
                  const isPending =
                    pendingCell === cellKey && regenerateVariants.isPending;

                  return (
                    <td key={format} className="py-1 px-1 text-center">
                      <div
                        className={cn(
                          "group relative flex items-center justify-center rounded-md px-1.5 py-1 min-h-[22px]",
                          variant
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <span className="flex items-center gap-1 group-hover:opacity-0 transition-opacity">
                              {variant ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  <span>
                                    {formatFileSize(variant.size_bytes)}
                                  </span>
                                </>
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRegenerate(size, format)}
                              title={`Regenerate ${size} ${format}`}
                              aria-label={`Regenerate ${size} ${format}`}
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-foreground/10"
                            >
                              <RefreshCcw className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
