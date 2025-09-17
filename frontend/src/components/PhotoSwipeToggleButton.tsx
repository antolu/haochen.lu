import React from 'react';
import { motion } from 'framer-motion';

interface PhotoSwipeToggleButtonProps {
  isVisible: boolean;
  isSidebarOpen: boolean;
  onClick: () => void;
}

const PhotoSwipeToggleButton: React.FC<PhotoSwipeToggleButtonProps> = ({
  isVisible,
  isSidebarOpen,
  onClick,
}) => {
  if (!isVisible) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed top-6 right-6 z-50 w-12 h-12 rounded-full bg-white bg-opacity-30 backdrop-blur-sm border border-white border-opacity-20 flex items-center justify-center text-white hover:bg-opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
      title={isSidebarOpen ? 'Hide photo details' : 'Show photo details'}
    >
      <motion.div
        animate={{ rotate: isSidebarOpen ? 180 : 0 }}
        transition={{ duration: 0.2 }}
      >
        {isSidebarOpen ? (
          // Close icon (X)
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Info icon
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </motion.div>
    </motion.button>
  );
};

export default PhotoSwipeToggleButton;
