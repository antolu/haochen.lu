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
  defaultShowInfo?: boolean;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  isOpen,
  initialIndex,
  onClose,
  onOpened,
  defaultShowInfo = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const infoBtnRef = useRef<HTMLButtonElement | null>(null);
  const injectRetryTimer = useRef<number | null>(null);

  const currentPhoto = photos[currentIndex];

  // Helper to inject the Info button into the global LG toolbar
  const injectToolbarButton = () => {
    const toolbar = document.querySelector('.lg-toolbar') as HTMLDivElement | null;
    if (!toolbar) return false;
    if (toolbar.querySelector('.lg-custom-info')) return true; // already exists

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lg-icon lg-custom-info';
    btn.setAttribute('aria-label', 'Show info');
    btn.title = 'Info';
    btn.innerHTML = '<span style="font-weight:600;font-family:system-ui">i</span>';
    btn.onclick = ev => {
      ev.preventDefault();
      setSidebarOpen(prev => !prev);
    };

    // Insert as the first child so it sits at the far left
    if (toolbar.firstChild) {
      toolbar.insertBefore(btn, toolbar.firstChild);
    } else {
      toolbar.appendChild(btn);
    }

    infoBtnRef.current = btn as HTMLButtonElement;
    return true;
  };

  // Try to inject the toolbar button with a short retry loop to account for LG DOM render timing
  const scheduleToolbarInjection = () => {
    let attempts = 0;
    const tryInject = () => {
      if (injectToolbarButton()) {
        injectRetryTimer.current = null;
        return;
      }
      attempts += 1;
      if (attempts < 10) {
        injectRetryTimer.current = window.setTimeout(tryInject, 50);
      } else {
        injectRetryTimer.current = null;
      }
    };
    tryInject();
  };

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

    const onBeforeSlide = (e: any) => setCurrentIndex(e.detail.index);
    const onAfterSlide = (e: any) => setCurrentIndex(e.detail.index);
    const onAfterClose = () => {
      setSidebarOpen(false);
      onClose();
    };

    containerRef.current.addEventListener('lgBeforeSlide', onBeforeSlide as any);
    containerRef.current.addEventListener('lgAfterSlide', onAfterSlide as any);
    containerRef.current.addEventListener('lgAfterClose', onAfterClose as any);

    return () => {
      if (!containerRef.current) return;
      containerRef.current.removeEventListener('lgBeforeSlide', onBeforeSlide as any);
      containerRef.current.removeEventListener('lgAfterSlide', onAfterSlide as any);
      containerRef.current.removeEventListener('lgAfterClose', onAfterClose as any);
      if (injectRetryTimer.current) window.clearTimeout(injectRetryTimer.current);
      if (galleryRef.current) {
        galleryRef.current.destroy();
      }
      infoBtnRef.current = null;
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
          // Inject toolbar button shortly after opening
          scheduleToolbarInjection();
          if (defaultShowInfo) {
            setSidebarOpen(true);
          }
          onOpened?.();
        }
      } catch (error) {}
    }
  }, [isOpen, initialIndex, photos, onOpened, defaultShowInfo]);

  // Sync aria-pressed and label on the toolbar button
  useEffect(() => {
    const btn = infoBtnRef.current;
    if (btn) {
      btn.setAttribute('aria-pressed', sidebarOpen ? 'true' : 'false');
      btn.setAttribute('aria-label', sidebarOpen ? 'Hide info' : 'Show info');
      btn.classList.toggle('lg-custom-info--active', !!sidebarOpen);
    }
  }, [sidebarOpen]);

  return (
    <>
      <div ref={containerRef} style={{ display: 'none' }} />

      {currentPhoto && sidebarOpen && (
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
