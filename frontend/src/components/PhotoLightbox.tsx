import React, { useRef, useEffect, useState } from 'react';
import lightGallery from 'lightgallery';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';
import lgFullscreen from 'lightgallery/plugins/fullscreen';

import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-zoom.css';
import 'lightgallery/css/lg-thumbnail.css';
import 'lightgallery/css/lg-fullscreen.css';
import '../styles/lightgallery-captions.css';

import PhotoSwipeMetadataSidebar from './PhotoSwipeMetadataSidebar';
import { generateCaptionHtml, generateMobileCaptionHtml } from '../utils/captionUtils';
import { selectOptimalImage, ImageUseCase } from '../utils/imageUtils';
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
  const downloadBtnRef = useRef<HTMLButtonElement | null>(null);

  const currentPhoto = photos[currentIndex];

  // Helper to detect if we're on mobile
  const isMobile = () => window.innerWidth <= 768;

  // Helper to generate caption HTML based on screen size
  const getCaptionHtml = (photo: Photo) => {
    return isMobile() ? generateMobileCaptionHtml(photo) : generateCaptionHtml(photo);
  };

  // Helper to handle photo download
  const handleDownload = async (photo: Photo, variant?: string) => {
    try {
      const endpoint = variant
        ? `/api/photos/${photo.id}/download/${variant}`
        : `/api/photos/${photo.id}/download`;

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, { headers });
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = variant ? `${photo.title}_${variant}.webp` : `${photo.title}_original.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Helper to inject toolbar buttons using LightGallery event system
  const injectToolbarButtons = (lgInstance: any) => {
    const toolbar = lgInstance.outer.find('.lg-toolbar');
    if (!toolbar || !toolbar[0]) return;

    // Clear any existing custom buttons
    toolbar.find('.lg-custom-info, .lg-custom-download').remove();

    // Create Info button
    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className = 'lg-icon lg-custom-info';
    infoBtn.setAttribute('aria-label', 'Show info');
    infoBtn.title = 'Info';
    infoBtn.innerHTML = '<span style="font-weight:600;font-family:system-ui">i</span>';
    infoBtn.onclick = ev => {
      ev.preventDefault();
      setSidebarOpen(prev => !prev);
    };

    // Create Download button
    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'lg-icon lg-custom-download';
    downloadBtn.setAttribute('aria-label', 'Download photo');
    downloadBtn.title = 'Download';
    downloadBtn.innerHTML = '<span style="font-weight:600;font-family:system-ui">↓</span>';
    downloadBtn.onclick = ev => {
      ev.preventDefault();
      handleDownload(currentPhoto);
    };

    // Insert buttons at the beginning of the toolbar
    toolbar[0].insertBefore(downloadBtn, toolbar[0].firstChild);
    toolbar[0].insertBefore(infoBtn, toolbar[0].firstChild);

    infoBtnRef.current = infoBtn;
    downloadBtnRef.current = downloadBtn;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const dynamicElements = photos.map(photo => {
      // Use DPI-aware selection for lightbox viewing (high quality)
      const lightboxImage = selectOptimalImage(photo, ImageUseCase.LIGHTBOX);
      const thumbnailImage = selectOptimalImage(photo, ImageUseCase.THUMBNAIL);

      return {
        src: lightboxImage.url,
        thumb: thumbnailImage.url,
        subHtml: getCaptionHtml(photo),
      };
    });

    const lgOptions: any = {
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
      // Caption settings for better mobile experience
      allowMediaOverlap: false, // Show captions below image on mobile
      slideDelay: 400, // Delay for caption animations
    };
    galleryRef.current = (lightGallery as any)(
      containerRef.current as unknown as HTMLElement,
      lgOptions as any
    );

    const onInit = (e: any) => {
      const lgInstance = e.detail.instance;
      injectToolbarButtons(lgInstance);
    };

    const onBeforeSlide = (e: any) => setCurrentIndex(e.detail.index);
    const onAfterSlide = (e: any) => setCurrentIndex(e.detail.index);
    const onAfterClose = () => {
      setSidebarOpen(false);
      onClose();
    };

    containerRef.current.addEventListener('lgInit', onInit as any);
    containerRef.current.addEventListener('lgBeforeSlide', onBeforeSlide as any);
    containerRef.current.addEventListener('lgAfterSlide', onAfterSlide as any);
    containerRef.current.addEventListener('lgAfterClose', onAfterClose as any);

    return () => {
      if (!containerRef.current) return;
      containerRef.current.removeEventListener('lgInit', onInit as any);
      containerRef.current.removeEventListener('lgBeforeSlide', onBeforeSlide as any);
      containerRef.current.removeEventListener('lgAfterSlide', onAfterSlide as any);
      containerRef.current.removeEventListener('lgAfterClose', onAfterClose as any);
      if (galleryRef.current) {
        galleryRef.current.destroy();
      }
      infoBtnRef.current = null;
      downloadBtnRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!galleryRef.current) return;

    if (isOpen) {
      const dynamicElements = photos.map(photo => {
        // Use DPI-aware selection for lightbox viewing (high quality)
        const lightboxImage = selectOptimalImage(photo, ImageUseCase.LIGHTBOX);
        const thumbnailImage = selectOptimalImage(photo, ImageUseCase.THUMBNAIL);

        return {
          src: lightboxImage.url,
          thumb: thumbnailImage.url,
          subHtml: getCaptionHtml(photo),
        };
      });

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
          if (defaultShowInfo) {
            setSidebarOpen(true);
          }
          onOpened?.();
        }
      } catch (error) {}
    }
  }, [isOpen, initialIndex, photos, onOpened, defaultShowInfo]);

  // Sync aria-pressed and label on the info toolbar button
  useEffect(() => {
    const infoBtn = infoBtnRef.current;
    if (infoBtn) {
      infoBtn.setAttribute('aria-pressed', sidebarOpen ? 'true' : 'false');
      infoBtn.setAttribute('aria-label', sidebarOpen ? 'Hide info' : 'Show info');
      infoBtn.classList.toggle('lg-custom-info--active', !!sidebarOpen);
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
