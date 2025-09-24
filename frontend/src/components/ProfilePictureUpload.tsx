import React, { useState, useRef, useCallback } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import PhotoDropzone, { type UploadFile } from "./PhotoDropzone";

export interface ProfilePictureUploadProps {
  onUpload: (file: File, title?: string) => Promise<void>;
  onCancel: () => void;
  isUploading?: boolean;
}

// Helper function to get square crop
function getCenterSquareCrop(mediaWidth: number, mediaHeight: number): Crop {
  const size = Math.min(mediaWidth, mediaHeight);
  return centerCrop(
    makeAspectCrop(
      {
        unit: "px",
        width: size,
      },
      1, // 1:1 aspect ratio (square)
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

// Convert canvas to File
function canvasToFile(
  canvas: HTMLCanvasElement,
  fileName: string,
): Promise<File> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], fileName, { type: "image/jpeg" });
          resolve(file);
        }
      },
      "image/jpeg",
      0.9,
    );
  });
}

const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
  onUpload,
  onCancel,
  isUploading = false,
}) => {
  const [imgSrc, setImgSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [title, setTitle] = useState<string>("");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      alert("File size must be less than 10MB.");
      return;
    }

    setOriginalFile(file);

    const reader = new FileReader();
    const onLoadHandler = () => {
      const result = reader.result;
      setImgSrc(typeof result === "string" ? result : "");
    };
    // Support both addEventListener and onload assignment for test environments
    if (
      typeof (reader as unknown as { addEventListener?: unknown })
        .addEventListener === "function"
    ) {
      (
        reader as unknown as {
          addEventListener: (type: string, cb: () => void) => void;
        }
      ).addEventListener("load", onLoadHandler);
    } else {
      // Fallback used by jsdom/vitest FileReader mocks
      (reader as unknown as { onload: (() => void) | null }).onload =
        onLoadHandler;
    }
    reader.readAsDataURL(file);
  }, []);

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        selectFile(file);
      }
    },
    [selectFile],
  );

  const onDropzoneFiles = useCallback(
    (files: UploadFile[]) => {
      const first = files.find((f) => f.status !== "error");
      if (first?.file) {
        selectFile(first.file);
      }
    },
    [selectFile],
  );

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      const newCrop = getCenterSquareCrop(width, height);
      setCrop(newCrop);
      setCompletedCrop(newCrop as PixelCrop);
    },
    [],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((file) => file.type.startsWith("image/"));

      if (imageFile) {
        selectFile(imageFile);
      }
    },
    [selectFile],
  );

  const getCroppedImg = useCallback(async (): Promise<File | null> => {
    const image = imgRef.current;
    const pixelCrop = completedCrop;

    if (!image || !pixelCrop || !originalFile) {
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

    // Convert canvas to file
    const fileName = `profile-${Date.now()}.jpg`;
    return canvasToFile(canvas, fileName);
  }, [completedCrop, originalFile]);

  const handleUpload = useCallback(async () => {
    const croppedFile = await getCroppedImg();
    if (croppedFile) {
      await onUpload(croppedFile, title || "Profile Picture");
    }
  }, [getCroppedImg, onUpload, title]);

  const reset = useCallback(() => {
    setImgSrc("");
    setCrop(undefined);
    setCompletedCrop(undefined);
    setTitle("");
    setOriginalFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleCancel = useCallback(() => {
    reset();
    onCancel();
  }, [reset, onCancel]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 max-w-lg mx-auto">
      <div className="mb-4">
        <p className="text-gray-700 text-sm">
          Select an image and crop it to a square.
        </p>
      </div>

      {!imgSrc ? (
        <div className="space-y-4">
          <PhotoDropzone
            onFilesAdded={onDropzoneFiles}
            maxFiles={1}
            maxFileSize={10 * 1024 * 1024}
            accept={{ "image/*": [".jpeg", ".jpg", ".png", ".webp"] }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileSelect}
            className="hidden"
          />

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Title removed per request */}

          {/* Crop Area */}
          <div className="border border-gray-300 rounded-lg overflow-hidden max-h-[55vh]">
            <ReactCrop
              crop={crop}
              onChange={(newCrop) => setCrop(newCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1} // Square aspect ratio
              minWidth={100}
              minHeight={100}
            >
              <img
                ref={imgRef}
                alt="Crop preview"
                src={imgSrc}
                onLoad={onImageLoad}
                className="max-h-[50vh] w-auto"
              />
            </ReactCrop>
          </div>

          {/* Preview */}
          {completedCrop && (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Preview (cropped area):
              </p>
              <div className="inline-block border-2 border-gray-300 rounded-full overflow-hidden">
                <canvas
                  ref={(canvas) => {
                    if (canvas && imgRef.current && completedCrop) {
                      const ctx = canvas.getContext("2d");
                      if (ctx) {
                        const image = imgRef.current;
                        const scaleX = image.naturalWidth / image.width;
                        const scaleY = image.naturalHeight / image.height;

                        canvas.width = 120;
                        canvas.height = 120;

                        ctx.drawImage(
                          image,
                          completedCrop.x * scaleX,
                          completedCrop.y * scaleY,
                          completedCrop.width * scaleX,
                          completedCrop.height * scaleY,
                          0,
                          0,
                          120,
                          120,
                        );
                      }
                    }
                  }}
                  className="block"
                  width={120}
                  height={120}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isUploading}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                fileInputRef.current?.click();
              }}
              disabled={isUploading}
              className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              Choose Different Image
            </button>
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={isUploading || !completedCrop}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "Uploading..." : "Upload Profile Picture"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePictureUpload;
