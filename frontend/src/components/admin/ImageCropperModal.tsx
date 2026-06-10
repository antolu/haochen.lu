import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";

export interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  aspectRatio?: number;
  onCrop: (croppedFile: File) => Promise<void> | void;
}

// Helper function to get initial crop
function getInitialCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspectRatio?: number,
): Crop {
  if (aspectRatio) {
    return centerCrop(
      makeAspectCrop(
        {
          unit: "%",
          width: 90,
        },
        aspectRatio,
        mediaWidth,
        mediaHeight,
      ),
      mediaWidth,
      mediaHeight,
    );
  }

  // Default to just centering a 90% crop if no aspect ratio
  return centerCrop(
    {
      unit: "%",
      width: 90,
      height: 90,
      x: 5,
      y: 5,
    },
    mediaWidth,
    mediaHeight,
  );
}

// Convert canvas to File
function canvasToFile(
  canvas: HTMLCanvasElement,
  fileName: string,
  type: string = "image/jpeg",
): Promise<File> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], fileName, { type });
          resolve(file);
        }
      },
      type,
      0.9,
    );
  });
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  onClose,
  file,
  aspectRatio = 16 / 9,
  onCrop,
}) => {
  const [imgSrc, setImgSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!file || !isOpen) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setImgSrc(typeof reader.result === "string" ? reader.result : "");
    });
    reader.readAsDataURL(file);
  }, [file, isOpen]);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      const newCrop = getInitialCrop(width, height, aspectRatio);
      setCrop(newCrop);
      setCompletedCrop(newCrop as PixelCrop);
    },
    [aspectRatio],
  );

  const getCroppedImg = useCallback(async (): Promise<File | null> => {
    const image = imgRef.current;
    const pixelCrop = completedCrop;

    if (!image || !pixelCrop || !file) {
      return null;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return null;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas size to the crop size
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height,
    );

    // Keep the original extension if possible
    const extension = file.name.split(".").pop() || "jpg";
    const type = file.type || "image/jpeg";
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const fileName = `${baseName}-cropped.${extension}`;

    return canvasToFile(canvas, fileName, type);
  }, [completedCrop, file]);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const croppedFile = await getCroppedImg();
      if (croppedFile) {
        await onCrop(croppedFile);
        onClose();
      }
    } catch (e) {
      console.error("Failed to crop image", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
          <DialogDescription>
            Adjust the framing. This will be the exact aspect ratio displayed on
            your portfolio.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex justify-center max-h-[60vh] overflow-hidden bg-muted rounded-md border border-border">
          {imgSrc && (
            <ReactCrop
              crop={crop}
              onChange={(newCrop) => setCrop(newCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
              className="max-h-[60vh] object-contain"
            >
              <img
                ref={imgRef}
                alt="Crop preview"
                src={imgSrc}
                onLoad={onImageLoad}
                className="max-h-[60vh] w-auto"
              />
            </ReactCrop>
          )}
        </div>

        {/* Live Preview (optional, can be helpful but might take space) */}
        {completedCrop && imgSrc && (
          <div className="mt-2 text-center hidden md:block">
            <span className="text-xs text-muted-foreground mr-4">Preview:</span>
            <div className="inline-block border border-border rounded overflow-hidden shadow-sm align-middle bg-muted">
              <canvas
                ref={(canvas) => {
                  if (canvas && imgRef.current && completedCrop) {
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                      const image = imgRef.current;
                      const scaleX = image.naturalWidth / image.width;
                      const scaleY = image.naturalHeight / image.height;

                      // Make preview 160px wide, height proportional
                      const previewWidth = 160;
                      const previewHeight = previewWidth / aspectRatio;

                      canvas.width = previewWidth;
                      canvas.height = previewHeight;

                      ctx.drawImage(
                        image,
                        completedCrop.x * scaleX,
                        completedCrop.y * scaleY,
                        completedCrop.width * scaleX,
                        completedCrop.height * scaleY,
                        0,
                        0,
                        previewWidth,
                        previewHeight,
                      );
                    }
                  }
                }}
                className="block"
                style={{
                  width: 160,
                  height: 160 / aspectRatio,
                }}
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Crop & Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
