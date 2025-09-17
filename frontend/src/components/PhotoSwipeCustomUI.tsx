import React, { useRef, useEffect, useState, useCallback } from 'react';
import PhotoSwipe from 'photoswipe';
import PhotoSwipeMetadataSidebar from './PhotoSwipeMetadataSidebar';
import PhotoSwipeToggleButton from './PhotoSwipeToggleButton';
import type { Photo } from '../types';

interface PhotoSwipeCustomUIProps {
  photos: Photo[];
  isOpen: boolean;
  initialIndex: number;
  onClose: () => void;
}

const PhotoSwipeCustomUI: React.FC<PhotoSwipeCustomUIProps> = ({
  photos,
  isOpen,
  initialIndex,
  onClose,
}) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(initialIndex);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const lightboxRef = useRef<PhotoSwipe | null>(null);

  const currentPhoto = photos[currentPhotoIndex];

  // Prepare data source for PhotoSwipe
  const dataSource = photos.map(photo => ({
    src: photo.variants?.xlarge?.path || photo.variants?.large?.path || photo.original_path,
    width: photo.width || 1200,
    height: photo.height || 800,
    alt: photo.title || 'Photo',
  }));

  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      handleSidebarToggle();
    }
  }, [handleSidebarToggle]);

  useEffect(() => {
    if (!isOpen || photos.length === 0) return;

    // PhotoSwipe options
    const options = {
      dataSource,
      index: initialIndex,
      bgOpacity: 0.95,
      showHideAnimationType: 'zoom' as const,
      zoom: true,
      close: true,
      counter: true,
      arrowPrev: true,
      arrowNext: true,
      wheelToZoom: true,
      pinchToClose: true,
      closeOnVerticalDrag: true,
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
    };

    // Initialize PhotoSwipe
    lightboxRef.current = new PhotoSwipe(options);
    
    // Event listeners
    lightboxRef.current.on('change', () => {
      if (lightboxRef.current) {
        setCurrentPhotoIndex(lightboxRef.current.currIndex);
      }
    });

    lightboxRef.current.on('close', () => {
      setIsSidebarOpen(false);
      onClose();
    });

    lightboxRef.current.on('destroy', () => {
      lightboxRef.current = null;
    });

    // Custom keyboard handling
    lightboxRef.current.on('keydown', (e) => {
      if (e.originalEvent?.key === 'i' || e.originalEvent?.key === 'I') {
        e.preventDefault();
        handleSidebarToggle();
      }
    });

    // Initialize PhotoSwipe
    lightboxRef.current.init();
    
    // Apply initial transform if sidebar should be open
    if (isSidebarOpen) {
      setTimeout(() => {
        const pswpElement = lightboxRef.current?.element;
        const scrollWrap = pswpElement?.querySelector('.pswp__scroll-wrap');
        if (scrollWrap) {
          (scrollWrap as HTMLElement).style.transform = 'translateX(-200px)';
          (scrollWrap as HTMLElement).style.transition = 'transform 0.3s ease-out';
        }
      }, 100);
    }

    // Add global keyboard listener
    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      if (lightboxRef.current) {
        lightboxRef.current.close();
      }
    };
  }, [isOpen, initialIndex, photos, dataSource, onClose, handleSidebarToggle, handleKeyPress, isSidebarOpen]);

  // Update PhotoSwipe container positioning when sidebar state changes
  useEffect(() => {
    if (lightboxRef.current && lightboxRef.current.element) {
      const pswpElement = lightboxRef.current.element;
      const scrollWrap = pswpElement.querySelector('.pswp__scroll-wrap');
      
      if (scrollWrap) {
        if (isSidebarOpen) {
          (scrollWrap as HTMLElement).style.transform = 'translateX(-200px)';
          (scrollWrap as HTMLElement).style.transition = 'transform 0.3s ease-out';
        } else {
          (scrollWrap as HTMLElement).style.transform = 'translateX(0)';
          (scrollWrap as HTMLElement).style.transition = 'transform 0.3s ease-out';
        }
      }
    }
  }, [isSidebarOpen]);

  if (!isOpen || !currentPhoto) {
    return null;
  }

  return (
    <>
      {/* Custom UI overlay */}
      {isOpen && (
        <>
          <PhotoSwipeToggleButton
            isVisible={isOpen}
            isSidebarOpen={isSidebarOpen}
            onClick={handleSidebarToggle}
          />

          {/* Metadata sidebar */}
          <PhotoSwipeMetadataSidebar
            photo={currentPhoto}
            isVisible={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
        </>
      )}
    </>
  );
};

export default PhotoSwipeCustomUI;
