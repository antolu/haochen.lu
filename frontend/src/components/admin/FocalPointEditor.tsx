import React, { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { heroImages } from "../../api/client";
import type { HeroImage, FocalPoint, ResponsiveFocalPoints } from "../../types";
import { selectOptimalImage, ImageUseCase } from "../../utils/imageUtils";

interface FocalPointEditorProps {
  heroImage: HeroImage;
  isOpen: boolean;
  onClose: () => void;
}

type DeviceType = "mobile" | "tablet" | "desktop";

const FocalPointEditor: React.FC<FocalPointEditorProps> = ({
  heroImage,
  isOpen,
  onClose,
}) => {
  const [activeDevice, setActiveDevice] = useState<DeviceType>("desktop");
  const [focalPoints, setFocalPoints] = useState<{
    default: FocalPoint;
    responsive: ResponsiveFocalPoints;
  }>({
    default: {
      x: heroImage.focal_point_x,
      y: heroImage.focal_point_y,
    },
    responsive: {
      mobile: heroImage.focal_points_responsive?.mobile ?? { x: 70, y: 50 },
      tablet: heroImage.focal_points_responsive?.tablet ?? { x: 60, y: 50 },
      desktop: heroImage.focal_points_responsive?.desktop ?? { x: 55, y: 50 },
    },
  });

  // Preview focal point (shows during mouse movement, before click)
  const [previewFocalPoint, setPreviewFocalPoint] = useState<FocalPoint | null>(
    null,
  );
  const [isHovering, setIsHovering] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Update focal points mutation
  const updateMutation = useMutation({
    mutationFn: (data: {
      focal_point_x: number;
      focal_point_y: number;
      focal_points_responsive: ResponsiveFocalPoints;
    }) => heroImages.updateFocalPoints(heroImage.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hero-images"] });
      onClose();
    },
  });

  const getCurrentFocalPoint = useCallback((): FocalPoint => {
    if (activeDevice === "mobile" && focalPoints.responsive.mobile) {
      return focalPoints.responsive.mobile;
    }
    if (activeDevice === "tablet" && focalPoints.responsive.tablet) {
      return focalPoints.responsive.tablet;
    }
    if (activeDevice === "desktop" && focalPoints.responsive.desktop) {
      return focalPoints.responsive.desktop;
    }
    return focalPoints.default;
  }, [activeDevice, focalPoints]);

  const setCurrentFocalPoint = useCallback(
    (point: FocalPoint) => {
      if (activeDevice === "mobile") {
        setFocalPoints((prev) => ({
          ...prev,
          responsive: { ...prev.responsive, mobile: point },
        }));
      } else if (activeDevice === "tablet") {
        setFocalPoints((prev) => ({
          ...prev,
          responsive: { ...prev.responsive, tablet: point },
        }));
      } else if (activeDevice === "desktop") {
        setFocalPoints((prev) => ({
          ...prev,
          responsive: { ...prev.responsive, desktop: point },
        }));
      }
      // Also update default to match desktop
      if (activeDevice === "desktop") {
        setFocalPoints((prev) => ({
          ...prev,
          default: point,
        }));
      }
    },
    [activeDevice],
  );

  // Utility function to calculate focal point from mouse/touch position
  const calculateFocalPoint = useCallback(
    (clientX: number, clientY: number): FocalPoint | null => {
      if (!imageRef.current) return null;

      const rect = imageRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;

      // Clamp values between 0 and 100
      const clampedX = Math.max(0, Math.min(100, x));
      const clampedY = Math.max(0, Math.min(100, y));

      return { x: clampedX, y: clampedY };
    },
    [],
  );

  const handleImageClick = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      const focalPoint = calculateFocalPoint(event.clientX, event.clientY);
      if (focalPoint) {
        setCurrentFocalPoint(focalPoint);
        setPreviewFocalPoint(null); // Clear preview on commit
      }
    },
    [calculateFocalPoint, setCurrentFocalPoint],
  );

  const handleImageMouseMove = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      if (!isHovering || !crosshairRef.current) return;

      const focalPoint = calculateFocalPoint(event.clientX, event.clientY);
      if (focalPoint) {
        // Direct DOM manipulation for smooth crosshair tracking
        crosshairRef.current.style.transform = `translate(-50%, -50%)`;
        crosshairRef.current.style.left = `${focalPoint.x}%`;
        crosshairRef.current.style.top = `${focalPoint.y}%`;

        // Update preview state for coordinate display (less frequent updates)
        setPreviewFocalPoint(focalPoint);
      }
    },
    [calculateFocalPoint, isHovering],
  );

  const handleImageMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleImageMouseLeave = useCallback(() => {
    setIsHovering(false);
    setPreviewFocalPoint(null);

    // Reset crosshair position to committed focal point
    if (crosshairRef.current) {
      const currentFocalPoint = getCurrentFocalPoint();
      crosshairRef.current.style.left = `${currentFocalPoint.x}%`;
      crosshairRef.current.style.top = `${currentFocalPoint.y}%`;
    }
  }, [getCurrentFocalPoint]);

  const handleSave = () => {
    updateMutation.mutate({
      focal_point_x: focalPoints.default.x,
      focal_point_y: focalPoints.default.y,
      focal_points_responsive: focalPoints.responsive,
    });
  };

  const handleReset = () => {
    setFocalPoints({
      default: {
        x: heroImage.focal_point_x,
        y: heroImage.focal_point_y,
      },
      responsive: {
        mobile: heroImage.focal_points_responsive?.mobile ?? { x: 70, y: 50 },
        tablet: heroImage.focal_points_responsive?.tablet ?? { x: 60, y: 50 },
        desktop: heroImage.focal_points_responsive?.desktop ?? { x: 55, y: 50 },
      },
    });
  };

  const currentFocalPoint = getCurrentFocalPoint();
  const displayedFocalPoint = previewFocalPoint ?? currentFocalPoint; // Show preview if available, otherwise show current
  const optimalImage = selectOptimalImage(
    heroImage.photo,
    ImageUseCase.LIGHTBOX,
  );

  const deviceStyles = {
    mobile: "max-w-sm aspect-[9/16]",
    tablet: "max-w-md aspect-[4/3]",
    desktop: "max-w-2xl aspect-[16/9]",
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Edit Focal Points
              </h3>
              <p className="text-gray-600">{heroImage.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ✕
            </button>
          </div>

          {/* Device Tabs */}
          <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
            {(["mobile", "tablet", "desktop"] as DeviceType[]).map((device) => (
              <button
                key={device}
                onClick={() => setActiveDevice(device)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeDevice === device
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {device.charAt(0).toUpperCase() + device.slice(1)}
              </button>
            ))}
          </div>

          {/* Main Editor */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Image Preview */}
            <div className="flex-1">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-900">
                    Preview ({activeDevice})
                  </h4>
                  {/* Help Tooltip */}
                  <div className="relative group">
                    <button
                      type="button"
                      className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex items-center justify-center text-xs text-gray-600 font-medium"
                      aria-label="Help"
                    >
                      ?
                    </button>
                    <div className="absolute left-0 top-6 z-50 w-80 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200">
                      <div className="absolute -top-1 left-3 w-2 h-2 bg-gray-900 rotate-45"></div>
                      <p>
                        <strong>Instructions:</strong> Hover over the image to
                        preview where the focal point will be set (blue
                        crosshair), then click to confirm (red crosshair) for{" "}
                        <strong>{activeDevice}</strong> devices. The focal point
                        determines where the image will be centered when cropped
                        for different screen sizes.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {previewFocalPoint ? (
                    <>
                      <span className="text-blue-600 font-medium">
                        Preview:
                      </span>{" "}
                      {previewFocalPoint.x.toFixed(1)}%,{" "}
                      {previewFocalPoint.y.toFixed(1)}%{" "}
                      <span className="text-xs text-gray-500">
                        (click to confirm)
                      </span>
                    </>
                  ) : (
                    <>
                      Current focal point: {currentFocalPoint.x.toFixed(1)}%,{" "}
                      {currentFocalPoint.y.toFixed(1)}%
                    </>
                  )}
                </div>
              </div>

              <div
                ref={containerRef}
                className={`mx-auto relative ${deviceStyles[activeDevice]} bg-gray-100 rounded-lg overflow-hidden shadow-lg`}
              >
                <img
                  ref={imageRef}
                  src={optimalImage.url}
                  srcSet={optimalImage.srcset}
                  sizes={optimalImage.sizes}
                  alt={heroImage.photo.title}
                  className="w-full h-full object-cover cursor-crosshair"
                  style={{
                    objectPosition: `${displayedFocalPoint.x}% ${displayedFocalPoint.y}%`,
                  }}
                  onClick={handleImageClick}
                  onMouseMove={handleImageMouseMove}
                  onMouseEnter={handleImageMouseEnter}
                  onMouseLeave={handleImageMouseLeave}
                  draggable={false}
                />

                {/* Crosshair Overlay - Optimized for GPU acceleration */}
                <div
                  ref={crosshairRef}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${displayedFocalPoint.x}%`,
                    top: `${displayedFocalPoint.y}%`,
                    transform: "translate(-50%, -50%)",
                    willChange: "transform",
                  }}
                >
                  <div className="relative">
                    {/* Crosshair lines - different colors for preview vs committed */}
                    <div
                      className={`absolute w-8 h-0.5 shadow-lg -translate-x-1/2 -translate-y-px transition-colors duration-150 ${
                        previewFocalPoint ? "bg-blue-400" : "bg-red-500"
                      }`}
                    />
                    <div
                      className={`absolute h-8 w-0.5 shadow-lg -translate-y-1/2 -translate-x-px transition-colors duration-150 ${
                        previewFocalPoint ? "bg-blue-400" : "bg-red-500"
                      }`}
                    />
                    {/* Center dot */}
                    <div
                      className={`w-2 h-2 rounded-full shadow-lg -translate-x-1/2 -translate-y-1/2 transition-colors duration-150 ${
                        previewFocalPoint ? "bg-blue-400" : "bg-red-500"
                      }`}
                    />
                  </div>
                </div>

                {/* Grid overlay for better positioning */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  <div className="grid grid-cols-3 grid-rows-3 w-full h-full">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-white/50" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="lg:w-80 space-y-6">
              {/* Manual Input */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-4">
                  Manual Adjustment
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      X Position ({currentFocalPoint.x.toFixed(1)}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={currentFocalPoint.x}
                      onChange={(e) => {
                        setCurrentFocalPoint({
                          ...currentFocalPoint,
                          x: parseFloat(e.target.value),
                        });
                        setPreviewFocalPoint(null); // Clear preview when manually adjusting
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Y Position ({currentFocalPoint.y.toFixed(1)}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={currentFocalPoint.y}
                      onChange={(e) => {
                        setCurrentFocalPoint({
                          ...currentFocalPoint,
                          y: parseFloat(e.target.value),
                        });
                        setPreviewFocalPoint(null); // Clear preview when manually adjusting
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-4">
                  Quick Presets
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Top Left", x: 25, y: 25 },
                    { label: "Top Center", x: 50, y: 25 },
                    { label: "Top Right", x: 75, y: 25 },
                    { label: "Left", x: 25, y: 50 },
                    { label: "Center", x: 50, y: 50 },
                    { label: "Right", x: 75, y: 50 },
                    { label: "Bottom Left", x: 25, y: 75 },
                    { label: "Bottom Center", x: 50, y: 75 },
                    { label: "Bottom Right", x: 75, y: 75 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setCurrentFocalPoint({ x: preset.x, y: preset.y });
                        setPreviewFocalPoint(null); // Clear preview when using preset
                      }}
                      className="text-xs p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Settings Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-4">
                  All Device Settings
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mobile:</span>
                    <span className="font-mono">
                      {focalPoints.responsive.mobile?.x.toFixed(1)}%,{" "}
                      {focalPoints.responsive.mobile?.y.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tablet:</span>
                    <span className="font-mono">
                      {focalPoints.responsive.tablet?.x.toFixed(1)}%,{" "}
                      {focalPoints.responsive.tablet?.y.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Desktop:</span>
                    <span className="font-mono">
                      {focalPoints.responsive.desktop?.x.toFixed(1)}%,{" "}
                      {focalPoints.responsive.desktop?.y.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-4 mt-8 pt-6 border-t">
            <button
              onClick={handleReset}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reset to Original
            </button>
            <button
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FocalPointEditor;
