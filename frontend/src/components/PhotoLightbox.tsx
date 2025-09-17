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

interface PhotoLightboxProps {
  photos: Photo[];
  isOpen: boolean;
  initialIndex: number;
  onClose: () => void;
  onOpened?: () => void;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
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

  useEffect(() => {
    if (!containerRef.current) return;

    const dynamicElements = photos.map(photo => ({
      src: photo.variants?.xlarge?.path || photo.variants?.large?.path || photo.original_path,
      thumb: photo.variants?.thumbnail?.path || photo.variants?.small?.path || photo.original_path,
      subHtml: `<h4>${photo.title || 'Untitled'}</h4>`,
    }));

    galleryRef.current = lightGallery(containerRef.current, {
      plugins: [lgThumbnail, lgZoom, lgFullscreen],
      licenseKey: '0000-0000-000-0000',
      dynamic: true,
      dynamicEl: dynamicElements,
      mode: 'lg-slide',
      speed: 500,
      thumbnail: true,
      showThumbByDefault: false,
      thumbWidth: 100,
      thumbHeight: 80,
      thumbMargin: 5,
      zoom: true,
      scale: 1,
      controls: true,
      download: false,
      closable: true,
      closeOnTap: false,
      escKey: true,
    });

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

    return () => {
      if (galleryRef.current) {
        galleryRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (!galleryRef.current) return;

    if (isOpen) {
      const dynamicElements = photos.map(photo => ({
        src: photo.variants?.xlarge?.path || photo.variants?.large?.path || photo.original_path,
        thumb:
          photo.variants?.thumbnail?.path || photo.variants?.small?.path || photo.original_path,
        subHtml: `<h4>${photo.title || 'Untitled'}</h4>`,
      }));

      try {
        if (dynamicElements.length === 0) {
          return;
        }
        const safeIndex = Math.max(0, Math.min(initialIndex, dynamicElements.length - 1));
        if (typeof galleryRef.current.refresh === 'function') {
          galleryRef.current.refresh(dynamicElements);
        } else if (typeof galleryRef.current.updateSlides === 'function') {
          galleryRef.current.updateSlides(dynamicElements, safeIndex);
        }
        const items = galleryRef.current.galleryItems || [];
        if (!items.length) {
          return;
        }
        setCurrentIndex(safeIndex);
        if (typeof galleryRef.current.openGallery === 'function') {
          galleryRef.current.openGallery(safeIndex);
          onOpened?.();
        }
      } catch (error) {}
    }
  }, [isOpen, initialIndex, photos, onOpened]);

  return (
    <>
      <div ref={containerRef} style={{ display: 'none' }} />
      {false && currentPhoto && sidebarOpen && (
        <PhotoSwipeMetadataSidebar
          photo={currentPhoto}
          isVisible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};

export default PhotoLightbox;
