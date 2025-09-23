import React, { useRef, useEffect, useState, useCallback } from "react";
import lightGallery from "lightgallery";
import lgThumbnail from "lightgallery/plugins/thumbnail";
import lgZoom from "lightgallery/plugins/zoom";
import lgFullscreen from "lightgallery/plugins/fullscreen";

// LightGallery type definitions
interface LightGalleryInstance {
  outer: Element[];
  find(selector: string): { remove(): void; length: number };
  addEventListener(
    event: string,
    handler: EventListenerOrEventListenerObject,
  ): void;
  removeEventListener(
    event: string,
    handler: EventListenerOrEventListenerObject,
  ): void;
}

import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";
import "lightgallery/css/lg-fullscreen.css";
import "../styles/lightgallery-captions.css";

import PhotoSwipeMetadataSidebar from "./PhotoSwipeMetadataSidebar";
import {
  generateCaptionHtml,
  generateMobileCaptionHtml,
} from "../utils/captionUtils";
import { selectOptimalImage, ImageUseCase } from "../utils/imageUtils";
import type { Photo } from "../types";

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
  const galleryRef = useRef<LightGalleryInstance | null>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const infoBtnRef = useRef<HTMLButtonElement | null>(null);
  const downloadBtnRef = useRef<HTMLButtonElement | null>(null);

  const currentPhoto = photos[currentIndex];

  // Helper to detect if we're on mobile
  const isMobile = () => window.innerWidth <= 768;

  // Helper to generate caption HTML based on screen size
  const getCaptionHtml = useCallback((photo: Photo) => {
    return isMobile()
      ? generateMobileCaptionHtml(photo)
      : generateCaptionHtml(photo);
  }, []);

  // Helper to handle photo download
  const handleDownload = async (photo: Photo, variant?: string) => {
    try {
      const endpoint = variant
        ? `/api/photos/${photo.id}/download/${variant}`
        : `/api/photos/${photo.id}/download`;

      const token = localStorage.getItem("token");
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
      const link = document.createElement("a");
      link.href = url;
      link.download = variant
        ? `${photo.title}_${variant}.webp`
        : `${photo.title}_original.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  // Helper to inject toolbar buttons using LightGallery event system
  const injectToolbarButtons = useCallback(
    (lgInstance: LightGalleryInstance) => {
      const toolbar = lgInstance.outer[0]?.querySelector(".lg-toolbar");
      if (!toolbar) return;

      // Clear any existing custom buttons
      toolbar
        .querySelectorAll(".lg-custom-info, .lg-custom-download")
        .forEach((el) => el.remove());

      // Create Info button
      const infoBtn = document.createElement("button");
      infoBtn.type = "button";
      infoBtn.className = "lg-icon lg-custom-info";
      infoBtn.setAttribute("aria-label", "Show info");
      infoBtn.title = "Info";
      infoBtn.innerHTML =
        '<span style="font-weight:600;font-family:system-ui">i</span>';
      infoBtn.onclick = (ev) => {
        ev.preventDefault();
        setSidebarOpen((prev) => !prev);
      };

      // Create Download button
      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className = "lg-icon lg-custom-download";
      downloadBtn.setAttribute("aria-label", "Download photo");
      downloadBtn.title = "Download";
      downloadBtn.innerHTML =
        '<span style="font-weight:600;font-family:system-ui">↓</span>';
      downloadBtn.onclick = (ev) => {
        ev.preventDefault();
        void handleDownload(currentPhoto);
      };

      // Insert buttons at the beginning of the toolbar
      toolbar.insertBefore(downloadBtn, toolbar.firstChild);
      toolbar.insertBefore(infoBtn, toolbar.firstChild);

      infoBtnRef.current = infoBtn;
      downloadBtnRef.current = downloadBtn;
    },
    [currentPhoto],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dynamicElements = photos.map((photo) => {
      // Use DPI-aware selection for lightbox viewing (high quality)
      const lightboxImage = selectOptimalImage(photo, ImageUseCase.LIGHTBOX);
      const thumbnailImage = selectOptimalImage(photo, ImageUseCase.THUMBNAIL);

      return {
        src: lightboxImage.url,
        thumb: thumbnailImage.url,
        subHtml: getCaptionHtml(photo),
      };
    });

    const lgOptions: Partial<{
      plugins: unknown[];
      licenseKey: string;
      dynamic: boolean;
      dynamicEl: Array<{ src: string; thumb: string; subHtml: string }>;
      mode: string;
      speed: number;
      thumbnail: boolean;
      showThumbByDefault: boolean;
      thumbWidth: number;
      thumbHeight: string;
      thumbMargin: number;
      zoom: boolean;
      scale: number;
      controls: boolean;
      download: boolean;
      closable: boolean;
      closeOnTap: boolean;
      escKey: boolean;
      allowMediaOverlap: boolean;
      slideDelay: number;
    }> = {
      plugins: [lgThumbnail, lgZoom, lgFullscreen],
      licenseKey: "0000-0000-000-0000",
      dynamic: true,
      dynamicEl: dynamicElements,
      mode: "lg-slide",
      speed: 500,
      thumbnail: true,
      showThumbByDefault: false,
      thumbWidth: 100,
      thumbHeight: "80px",
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
    galleryRef.current = lightGallery(
      container as HTMLElement,
      lgOptions as unknown as Record<string, unknown>,
    ) as unknown as LightGalleryInstance;

    const onInit = (e: Event) => {
      const detail = (e as unknown as { detail?: { instance?: unknown } })
        .detail;
      const instance = detail?.instance as LightGalleryInstance | undefined;
      if (instance) {
        injectToolbarButtons(instance);
      }
    };

    const onBeforeSlide = (e: Event) => {
      const detail = (e as unknown as { detail?: { index?: number } }).detail;
      if (typeof detail?.index === "number") {
        setCurrentIndex(detail.index);
      }
    };
    const onAfterSlide = (e: Event) => {
      const detail = (e as unknown as { detail?: { index?: number } }).detail;
      if (typeof detail?.index === "number") {
        setCurrentIndex(detail.index);
      }
    };
    const onAfterClose = () => {
      setSidebarOpen(false);
      onClose();
    };

    container.addEventListener("lgInit", onInit);
    container.addEventListener("lgBeforeSlide", onBeforeSlide);
    container.addEventListener("lgAfterSlide", onAfterSlide);
    container.addEventListener("lgAfterClose", onAfterClose);

    return () => {
      if (!container) return;
      container.removeEventListener("lgInit", onInit);
      container.removeEventListener("lgBeforeSlide", onBeforeSlide);
      container.removeEventListener("lgAfterSlide", onAfterSlide);
      container.removeEventListener("lgAfterClose", onAfterClose);
      if (galleryRef.current && "destroy" in galleryRef.current) {
        (galleryRef.current as unknown as { destroy(): void }).destroy();
      }
      infoBtnRef.current = null;
      downloadBtnRef.current = null;
    };
  }, [photos, getCaptionHtml, injectToolbarButtons, onClose]);

  useEffect(() => {
    if (!galleryRef.current) return;

    if (isOpen) {
      const dynamicElements = photos.map((photo) => {
        // Use DPI-aware selection for lightbox viewing (high quality)
        const lightboxImage = selectOptimalImage(photo, ImageUseCase.LIGHTBOX);
        const thumbnailImage = selectOptimalImage(
          photo,
          ImageUseCase.THUMBNAIL,
        );

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
        const safeIndex = Math.max(
          0,
          Math.min(initialIndex, dynamicElements.length - 1),
        );
        const gallery = galleryRef.current as unknown as {
          refresh?: (
            elements: Array<{ src: string; thumb: string; subHtml: string }>,
          ) => void;
          updateSlides?: (
            elements: Array<{ src: string; thumb: string; subHtml: string }>,
            index: number,
          ) => void;
          galleryItems?: unknown[];
          openGallery?: (index: number) => void;
        };

        if (typeof gallery.refresh === "function") {
          gallery.refresh(dynamicElements);
        } else if (typeof gallery.updateSlides === "function") {
          gallery.updateSlides(dynamicElements, safeIndex);
        }
        const items = gallery.galleryItems ?? [];
        if (!items.length) {
          return;
        }
        setCurrentIndex(safeIndex);
        if (typeof gallery.openGallery === "function") {
          gallery.openGallery(safeIndex);
          if (defaultShowInfo) {
            setSidebarOpen(true);
          }
          onOpened?.();
        }
      } catch (error) {
        console.error("Failed to open gallery:", error);
      }
    }
  }, [isOpen, initialIndex, photos, onOpened, defaultShowInfo, getCaptionHtml]);

  // Sync aria-pressed and label on the info toolbar button
  useEffect(() => {
    const infoBtn = infoBtnRef.current;
    if (infoBtn) {
      infoBtn.setAttribute("aria-pressed", sidebarOpen ? "true" : "false");
      infoBtn.setAttribute(
        "aria-label",
        sidebarOpen ? "Hide info" : "Show info",
      );
      infoBtn.classList.toggle("lg-custom-info--active", !!sidebarOpen);
    }
  }, [sidebarOpen]);

  return (
    <>
      <div ref={containerRef} style={{ display: "none" }} />

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
