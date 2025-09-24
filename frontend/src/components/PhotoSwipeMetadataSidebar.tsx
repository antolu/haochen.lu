import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import MiniMap from "./MiniMap";
import MapModal from "./MapModal";
import type { Photo } from "../types";
import { formatDate } from "../utils/dateFormat";

interface PhotoSwipeMetadataSidebarProps {
  photo: Photo;
  isVisible: boolean;
  onClose?: () => void;
  onSidebarClose?: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = true,
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-4 text-left hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center space-x-2">
          {icon}
          <span className="font-medium text-white">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PhotoSwipeMetadataSidebar: React.FC<PhotoSwipeMetadataSidebarProps> = ({
  photo,
  isVisible,
  onClose,
  onSidebarClose,
}) => {
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const hasLocationData = photo.location_lat && photo.location_lon;
  const hasCameraData =
    photo.camera_display_name ??
    photo.lens_display_name ??
    photo.camera_make ??
    photo.camera_model ??
    photo.lens;
  const hasTechnicalData =
    photo.aperture ?? photo.shutter_speed ?? photo.iso ?? photo.focal_length;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-50 lg:hidden"
            style={{ zIndex: 2050 }}
            onClick={onSidebarClose ?? onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed top-0 right-0 h-full w-full lg:w-96 bg-gray-900 shadow-2xl overflow-y-auto lg:!w-[24rem] lg:max-w-[24rem]"
            style={{ zIndex: 2080 }}
            onClick={(e) => e.stopPropagation()}
          >
            {process.env.NODE_ENV !== "production" ? (
              <div className="hidden" aria-hidden>
                {/* debug: sidebar render */}
              </div>
            ) : null}
            {/* Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Photo Details
                </h2>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    (onSidebarClose ?? onClose)?.();
                  }}
                  className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                >
                  <svg
                    className="h-5 w-5 text-gray-400"
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
            </div>

            {/* Content */}
            <div className="divide-y divide-gray-700">
              {/* Basic Info - Always show this section */}
              <CollapsibleSection
                title="File Details"
                defaultOpen={true}
                icon={
                  <svg
                    className="h-4 w-4 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                }
              >
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-400">Dimensions:</span>
                    <p className="text-gray-300">
                      {photo.width} × {photo.height} pixels
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-400">File size:</span>
                    <p className="text-gray-300">
                      {Math.round((photo.file_size / 1024 / 1024) * 100) / 100}{" "}
                      MB
                    </p>
                  </div>

                  {photo.tags?.trim() && (
                    <div>
                      <span className="text-gray-400">Tags:</span>
                      <p className="text-gray-300">{photo.tags}</p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Camera Information */}
              {hasCameraData && (
                <CollapsibleSection
                  title="Equipment"
                  defaultOpen={true}
                  icon={
                    <svg
                      className="h-4 w-4 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  }
                >
                  <div className="space-y-2 text-sm">
                    {(photo.camera_display_name ??
                      photo.camera_make ??
                      photo.camera_model) && (
                      <div>
                        <span className="text-gray-400">Camera:</span>
                        <p className="text-gray-300">
                          {photo.camera_display_name ??
                            `${photo.camera_make ?? ""} ${photo.camera_model ?? ""}`.trim()}
                        </p>
                      </div>
                    )}
                    {(photo.lens_display_name ?? photo.lens) && (
                      <div>
                        <span className="text-gray-400">Lens:</span>
                        <p className="text-gray-300">
                          {photo.lens_display_name ?? photo.lens}
                        </p>
                      </div>
                    )}
                    {photo.date_taken && (
                      <div>
                        <span className="text-gray-400">Date taken:</span>
                        <p className="text-gray-300">
                          {formatDate(photo.date_taken)}
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Technical Settings */}
              {hasTechnicalData && (
                <CollapsibleSection
                  title="Technical Settings"
                  defaultOpen={true}
                  icon={
                    <svg
                      className="h-4 w-4 text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  }
                >
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {photo.aperture && (
                      <div>
                        <span className="text-gray-400">Aperture:</span>
                        <p className="text-gray-300">f/{photo.aperture}</p>
                      </div>
                    )}
                    {photo.shutter_speed && (
                      <div>
                        <span className="text-gray-400">Shutter:</span>
                        <p className="text-gray-300">{photo.shutter_speed}s</p>
                      </div>
                    )}
                    {photo.iso && (
                      <div>
                        <span className="text-gray-400">ISO:</span>
                        <p className="text-gray-300">{photo.iso}</p>
                      </div>
                    )}
                    {photo.focal_length && (
                      <div>
                        <span className="text-gray-400">Focal Length:</span>
                        <p className="text-gray-300">{photo.focal_length}mm</p>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Location at bottom of pane */}
              {hasLocationData && (
                <CollapsibleSection
                  title="Location"
                  icon={
                    <svg
                      className="h-4 w-4 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  }
                >
                  <div className="space-y-3">
                    {photo.location_name && (
                      <div>
                        <span className="text-gray-400 text-sm">Location:</span>
                        <p className="text-gray-300">{photo.location_name}</p>
                      </div>
                    )}

                    <div>
                      <span className="text-gray-400 text-sm">
                        Coordinates:
                      </span>
                      <p className="text-gray-300 text-xs font-mono">
                        {photo.location_lat?.toFixed(6)},{" "}
                        {photo.location_lon?.toFixed(6)}
                      </p>
                    </div>

                    <div className="border border-gray-700 rounded-lg overflow-hidden mt-2">
                      <MiniMap
                        latitude={photo.location_lat ?? 0}
                        longitude={photo.location_lon ?? 0}
                        zoom={13}
                        responsive={true}
                        aspectRatio="square"
                        className="w-full"
                        onClick={() => setIsMapModalOpen(true)}
                      />
                    </div>
                  </div>
                </CollapsibleSection>
              )}
            </div>
          </motion.div>

          {/* Map Modal */}
          {hasLocationData && (
            <MapModal
              isOpen={isMapModalOpen}
              onClose={() => setIsMapModalOpen(false)}
              latitude={photo.location_lat ?? 0}
              longitude={photo.location_lon ?? 0}
              locationName={photo.location_name ?? undefined}
              zoom={15}
            />
          )}
        </>
      )}
    </AnimatePresence>
  );
};

export default PhotoSwipeMetadataSidebar;
