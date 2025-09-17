import React, { useCallback, useEffect, useRef, useState } from 'react';
import LightGallery from 'lightgallery/react';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';
import lgFullscreen from 'lightgallery/plugins/fullscreen';

// Import LightGallery CSS
import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-zoom.css';
import 'lightgallery/css/lg-thumbnail.css';
import 'lightgallery/css/lg-fullscreen.css';

import PhotoSwipeMetadataSidebar from './PhotoSwipeMetadataSidebar';
import type { Photo } from '../types';

interface LightGallerySimpleProps {
  photos: Photo[];
  isOpen: boolean;
  initialIndex: number;
  onClose: () => void;
}

const LightGallerySimple: React.FC<LightGallerySimpleProps> = ({
  photos,
  isOpen,
  initialIndex,
  onClose,
}) => {
  const lightGalleryRef = useRef<any>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(initialIndex);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentPhoto = photos[currentPhotoIndex];

  // Update current photo index when initialIndex changes
  useEffect(() => {
    setCurrentPhotoIndex(initialIndex);
  }, [initialIndex]);

  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const onInit = useCallback(
    (detail: any) => {
      console.log('LightGallery Simple initialized', {
        photos: photos.length,
        initialIndex,
        detail,
      });
      lightGalleryRef.current = detail.instance;

      // Add custom info button after gallery initialization
      setTimeout(() => {
        const toolbar = document.querySelector('.lg-toolbar');
        if (toolbar && !toolbar.querySelector('.lg-custom-info-btn')) {
          const infoButton = document.createElement('button');
          infoButton.className = 'lg-icon lg-custom-info-btn';
          infoButton.innerHTML = '<span>i</span>';
          infoButton.style.cssText = `
          background: transparent !important;
          border: none !important;
          color: white !important;
          font-size: 24px !important;
          font-weight: bold !important;
          text-shadow: 0 0 4px rgba(0,0,0,0.8) !important;
          cursor: pointer !important;
          padding: 8px 12px !important;
          margin-left: 8px !important;
          transition: all 0.2s ease !important;
        `;

          infoButton.addEventListener('mouseenter', () => {
            infoButton.style.color = 'rgba(59, 130, 246, 1) !important';
            infoButton.style.transform = 'scale(1.2)';
          });

          infoButton.addEventListener('mouseleave', () => {
            infoButton.style.color = 'white !important';
            infoButton.style.transform = 'scale(1)';
          });

          infoButton.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            handleSidebarToggle();
          });

          toolbar.appendChild(infoButton);
        }
      }, 500);
    },
    [handleSidebarToggle, photos.length, initialIndex]
  );

  const onAfterSlide = useCallback((detail: any) => {
    console.log('After slide:', detail);
    setCurrentPhotoIndex(detail.index);
  }, []);

  const onBeforeSlide = useCallback((detail: any) => {
    console.log('Before slide:', detail);
  }, []);

  const onBeforeClose = useCallback(() => {
    console.log('Before close - user triggered');
    setIsSidebarOpen(false);
    onClose();
  }, [onClose]);

  // Open gallery by triggering click on the correct item
  useEffect(() => {
    if (isOpen && photos.length > 0) {
      console.log('Triggering gallery open for index:', initialIndex);
      setTimeout(() => {
        const galleryItems = document.querySelectorAll('.lg-custom-gallery a');
        const targetItem = galleryItems[initialIndex];
        if (targetItem) {
          console.log('Clicking gallery item:', initialIndex);
          (targetItem as HTMLElement).click();
        }
      }, 100);
    }
  }, [isOpen, initialIndex, photos.length]);

  console.log('LightGallerySimple component called:', {
    isOpen,
    photosLength: photos.length,
    initialIndex,
  });

  if (!isOpen || photos.length === 0) {
    console.log('LightGallerySimple not rendering:', { isOpen, photosLength: photos.length });
    return null;
  }

  console.log('LightGallerySimple rendering...', {
    isOpen,
    photosLength: photos.length,
    initialIndex,
  });

  return (
    <>
      <LightGallery
        onInit={onInit}
        onBeforeSlide={onBeforeSlide}
        onAfterSlide={onAfterSlide}
        onBeforeClose={onBeforeClose}
        speed={500}
        plugins={[lgThumbnail, lgZoom, lgFullscreen]}
        mode="lg-slide"
        thumbnail={true}
        animateThumb={true}
        showThumbByDefault={false}
        thumbWidth={100}
        thumbHeight={80}
        thumbMargin={5}
        zoom={true}
        scale={1}
        keyPress={true}
        escKey={true}
        controls={true}
        download={false}
        closable={true}
        swipeToClose={false}
        addClass="lg-custom-toolbar"
        elementClassNames="lg-custom-gallery"
        ref={lightGalleryRef}
        startIndex={initialIndex}
      >
        {photos.map((photo, index) => (
          <a
            key={photo.id}
            href={
              photo.variants?.xlarge?.path || photo.variants?.large?.path || photo.original_path
            }
            data-lg-size="1200-800"
            data-src={
              photo.variants?.xlarge?.path || photo.variants?.large?.path || photo.original_path
            }
            data-sub-html={`<h4>${photo.title || 'Untitled'}</h4>${photo.description ? `<p>${photo.description}</p>` : ''}`}
            style={{ display: 'none' }}
          >
            <img
              src={
                photo.variants?.thumbnail?.path ||
                photo.variants?.small?.path ||
                photo.original_path
              }
              alt={photo.title || 'Photo'}
            />
          </a>
        ))}
      </LightGallery>

      {/* Metadata sidebar */}
      {currentPhoto && (
        <PhotoSwipeMetadataSidebar
          photo={currentPhoto}
          isVisible={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}
    </>
  );
};

export default LightGallerySimple;
