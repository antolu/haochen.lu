import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import InteractiveMap from "./InteractiveMap";

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number;
  longitude: number;
  locationName?: string;
  zoom?: number;
}

const MapModal: React.FC<MapModalProps> = ({
  isOpen,
  onClose,
  latitude,
  longitude,
  locationName,
  zoom = 15,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black bg-opacity-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {locationName ? `Location: ${locationName}` : "Photo Location"}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
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

            {/* Map Content */}
            <div className="relative">
              <InteractiveMap
                latitude={latitude}
                longitude={longitude}
                zoom={zoom}
                height={500}
                className="border-0"
                minZoom={1}
                maxZoom={19}
              />
            </div>

            {/* Footer with coordinates */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>
                  Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
                      window.open(url, "_blank");
                    }}
                    className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                  >
                    Open in Google Maps
                  </button>
                  <button
                    onClick={() => {
                      const url = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=${zoom}`;
                      window.open(url, "_blank");
                    }}
                    className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
                  >
                    Open in OpenStreetMap
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MapModal;
