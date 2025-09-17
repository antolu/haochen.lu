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
  const pswpRef = useRef<HTMLDivElement>(null);

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
    if (!isOpen || !pswpRef.current || photos.length === 0) return;

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
      padding: { top: 60, bottom: 60, left: 60, right: isSidebarOpen ? 420 : 60 },
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

    // Add global keyboard listener
    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      if (lightboxRef.current) {
        lightboxRef.current.close();
      }
    };
  }, [isOpen, initialIndex, photos, dataSource, onClose, handleSidebarToggle, handleKeyPress, isSidebarOpen]);

  // Update padding when sidebar state changes
  useEffect(() => {
    if (lightboxRef.current) {
      lightboxRef.current.options.padding = {
        top: 60,
        bottom: 60,
        left: 60,
        right: isSidebarOpen ? 420 : 60,
      };
      lightboxRef.current.updateSize();
    }
  }, [isSidebarOpen]);

  if (!isOpen || !currentPhoto) {
    return null;
  }

  return (
    <>
      {/* PhotoSwipe container */}
      <div 
        ref={pswpRef}
        className="pswp"
        tabIndex={-1}
        role="dialog"
        aria-hidden="true"
        style={{ display: 'none' }}
      >
        <div className="pswp__bg"></div>
        <div className="pswp__scroll-wrap">
          <div className="pswp__container">
            <div className="pswp__item"></div>
            <div className="pswp__item"></div>
            <div className="pswp__item"></div>
          </div>
          <div className="pswp__ui pswp__ui--hidden">
            <div className="pswp__top-bar">
              <div className="pswp__counter"></div>
              <button className="pswp__button pswp__button--close" title="Close (Esc)"></button>
              <button className="pswp__button pswp__button--zoom" title="Zoom in/out"></button>
              <div className="pswp__preloader">
                <div className="pswp__preloader__icn">
                  <div className="pswp__preloader__cut">
                    <div className="pswp__preloader__donut"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="pswp__share-modal pswp__share-modal--hidden pswp__single-tap">
              <div className="pswp__share-tooltip"></div>
            </div>
            <button className="pswp__button pswp__button--arrow--left" title="Previous (arrow left)"></button>
            <button className="pswp__button pswp__button--arrow--right" title="Next (arrow right)"></button>
            <div className="pswp__caption">
              <div className="pswp__caption__center"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom UI overlay */}
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
  );
};

export default PhotoSwipeCustomUI;
