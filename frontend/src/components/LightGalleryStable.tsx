import React, { useRef, useEffect, useState } from 'react';
import lightGallery from 'lightgallery';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';
import lgFullscreen from 'lightgallery/plugins/fullscreen';

import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-zoom.css';
import 'lightgallery/css/lg-thumbnail.css';
import 'lightgallery/css/lg-fullscreen.css';

import PhotoSwipeMetadataSidebar from './PhotoSwipeMetadataSidebar';
import type { Photo } from '../types';

interface LightGalleryStableProps {
  photos: Photo[];
  isOpen: boolean;
  initialIndex: number;
  onClose: () => void;
  onOpened?: () => void;
}

const LightGalleryStable: React.FC<LightGalleryStableProps> = ({
  photos,
  isOpen,
  initialIndex,
  onClose,
  onOpened,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPhoto = photos[currentIndex];

  // Initialize gallery once when component mounts
  useEffect(() => {
    if (!containerRef.current) return;

    // Build dynamic elements
    const dynamicElements = photos.map(photo => ({
      src: photo.variants?.xlarge?.path || photo.variants?.large?.path || photo.original_path,
      thumb: photo.variants?.thumbnail?.path || photo.variants?.small?.path || photo.original_path,
      subHtml: `<h4>${photo.title || 'Untitled'}</h4>`,
    }));

    // Initialize gallery with all settings
    galleryRef.current = lightGallery(containerRef.current, {
      plugins: [lgThumbnail, lgZoom, lgFullscreen],
      licenseKey: '0000-0000-000-0000',
      // Dynamic mode
      dynamic: true,
      dynamicEl: dynamicElements,
      // Core settings
      mode: 'lg-slide',
      speed: 500,
      // Thumbnail settings
      thumbnail: true,
      showThumbByDefault: false,
      thumbWidth: 100,
      thumbHeight: 80,
      thumbMargin: 5,
      // Zoom settings
      zoom: true,
      scale: 1,
      // Controls
      controls: true,
      download: false,
      // Close behavior
      closable: true,
      closeOnTap: false,
      escKey: true,
    });

    // Add event listeners
    containerRef.current.addEventListener('lgBeforeSlide', (e: any) => {
      setCurrentIndex(e.detail.index);
    });

    containerRef.current.addEventListener('lgAfterSlide', (e: any) => {
      setCurrentIndex(e.detail.index);
    });

    containerRef.current.addEventListener('lgAfterClose', () => {
      setSidebarOpen(false);
      onClose();
    });

    // Cleanup on unmount
    return () => {
      if (galleryRef.current) {
        galleryRef.current.destroy();
      }
    };
  }, []); // Only run once on mount

  // Handle opening/closing
  useEffect(() => {
    if (!galleryRef.current) return;

    if (isOpen) {
      // Update dynamic elements if photos changed
      const dynamicElements = photos.map(photo => ({
        src: photo.variants?.xlarge?.path || photo.variants?.large?.path || photo.original_path,
        thumb:
          photo.variants?.thumbnail?.path || photo.variants?.small?.path || photo.original_path,
        subHtml: `<h4>${photo.title || 'Untitled'}</h4>`,
      }));

      // Update slides and open
      try {
        galleryRef.current.updateSlides(dynamicElements, initialIndex);
        galleryRef.current.openGallery(initialIndex);
        onOpened?.();
      } catch (error) {
        console.error('Error opening gallery:', error);
      }
    }
  }, [isOpen, initialIndex, photos, onOpened]);

  // Always render the component, but hide it when closed

  return (
    <>
      <div ref={containerRef} style={{ display: 'none' }}>
        {/* Hidden container for LightGallery */}
      </div>

      {/* Sidebar - Disabled for testing */}
      {false && currentPhoto && sidebarOpen && (
        <PhotoSwipeMetadataSidebar
          photo={currentPhoto}
          isVisible={sidebarOpen}
          onSidebarClose={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};

export default LightGalleryStable;
