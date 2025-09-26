import React, { useRef, useEffect, useState, useCallback } from "react";
import lightGallery from "lightgallery";
import lgThumbnail from "lightgallery/plugins/thumbnail";
import lgZoom from "lightgallery/plugins/zoom";
import lgFullscreen from "lightgallery/plugins/fullscreen";
import lgShare from "lightgallery/plugins/share";
import lgHash from "lightgallery/plugins/hash";
import lgRotate from "lightgallery/plugins/rotate";
import { lgSidebar } from "./lightgallery-plugins";

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
  openGallery(index?: number): void;
  closeGallery(): void;
  slide(index: number): void;
  destroy(): void;
}

import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";
import "lightgallery/css/lg-fullscreen.css";
import "lightgallery/css/lg-share.css";
import "lightgallery/css/lg-medium-zoom.css";
import "lightgallery/css/lg-rotate.css";
import "../styles/lightgallery-captions.css";

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
  const galleryOpenedRef = useRef<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const downloadBtnRef = useRef<HTMLButtonElement | null>(null);

  const currentPhoto = photos[currentIndex];

  // Helper to detect if we're on mobile
  const isMobile = () => window.innerWidth <= 768;

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

  // Helper to inject download button using LightGallery event system
  const injectDownloadButton = useCallback(
    (lgInstance: LightGalleryInstance) => {
      const toolbar = lgInstance.outer[0]?.querySelector(".lg-toolbar");
      if (!toolbar) return;

      // Clear any existing custom download buttons
      toolbar
        .querySelectorAll(".lg-custom-download")
        .forEach((el) => el.remove());

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

      // Insert download button at the beginning of the toolbar
      toolbar.insertBefore(downloadBtn, toolbar.firstChild);
      downloadBtnRef.current = downloadBtn;
    },
    [currentPhoto],
  );

  // Create gallery only when needed (when opening)
  const createGallery = useCallback(() => {
    const container = containerRef.current;
    if (!container || photos.length === 0) {
      return null;
    }

    // Clean up any existing gallery instance
    if (galleryRef.current) {
      try {
        galleryRef.current.destroy();
      } catch (error) {
        console.error("Error destroying previous gallery:", error);
      }
      galleryRef.current = null;
      galleryOpenedRef.current = false;
    }

    const dynamicElements = photos.map((photo) => {
      // Use DPI-aware selection for lightbox viewing (high quality)
      const lightboxImage = selectOptimalImage(photo, ImageUseCase.LIGHTBOX);
      const thumbnailImage = selectOptimalImage(photo, ImageUseCase.THUMBNAIL);

      const captionHtml = isMobile()
        ? generateMobileCaptionHtml(photo)
        : generateCaptionHtml(photo);

      return {
        src: lightboxImage.url,
        thumb: thumbnailImage.url,
        subHtml: captionHtml,
        photoData: photo, // Add photo data for sidebar plugin
      };
    });

    const lgOptions: Partial<{
      plugins: unknown[];
      licenseKey: string;
      dynamic: boolean;
      dynamicEl: Array<{
        src: string;
        thumb: string;
        subHtml: string;
        photoData?: Photo;
      }>;
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
      // Share plugin options
      share: boolean;
      facebook: boolean;
      twitter: boolean;
      pinterest: boolean;
      // Hash plugin options
      hash: boolean;
      galleryId: string;
      // Rotate plugin options
      rotate: boolean;
      rotateLeft: boolean;
      rotateRight: boolean;
      flipHorizontal: boolean;
      flipVertical: boolean;
      // Medium zoom options
      mediumZoom: boolean;
      backgroundColor: string;
      margin: number;
      // Sidebar plugin options
      sidebar: boolean;
      sidebarPosition: "left" | "right";
      sidebarWidth: number;
      sidebarAutoShow: boolean;
      sidebarToggleBtn: boolean;
      sidebarToggleKey: string;
    }> = {
      plugins: [
        lgThumbnail,
        lgZoom,
        lgFullscreen,
        lgShare,
        lgRotate,
        lgHash,
        lgSidebar,
      ],
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
      // Share plugin settings
      share: true,
      facebook: true,
      twitter: true,
      pinterest: true,
      // Hash plugin settings
      hash: true,
      galleryId: "photography-lightbox",
      // Rotate plugin settings
      rotate: true,
      rotateLeft: true,
      rotateRight: true,
      flipHorizontal: true,
      flipVertical: true,
      // Medium zoom settings - disabled due to conflict with regular zoom
      mediumZoom: false,
      backgroundColor: "rgba(0, 0, 0, 0.9)",
      margin: 48,
      // Sidebar plugin settings
      sidebar: true,
      sidebarPosition: "right" as const,
      sidebarWidth: 400,
      sidebarAutoShow: defaultShowInfo,
      sidebarToggleBtn: true,
      sidebarToggleKey: "i",
    };

    try {
      galleryRef.current = lightGallery(
        container as HTMLElement,
        lgOptions as unknown as Record<string, unknown>,
      ) as unknown as LightGalleryInstance;

      const onInit = (e: Event) => {
        const detail = (e as unknown as { detail?: { instance?: unknown } })
          .detail;
        const instance = detail?.instance as LightGalleryInstance | undefined;
        if (instance) {
          injectDownloadButton(instance);
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
        // Reset gallery state so it can be reopened
        galleryOpenedRef.current = false;
        onClose();
      };

      container.addEventListener("lgInit", onInit);
      container.addEventListener("lgBeforeSlide", onBeforeSlide);
      container.addEventListener("lgAfterSlide", onAfterSlide);
      container.addEventListener("lgAfterClose", onAfterClose);

      // Store event handlers for cleanup
      const eventHandlers = {
        onInit,
        onBeforeSlide,
        onAfterSlide,
        onAfterClose,
      };

      return () => {
        if (container) {
          container.removeEventListener("lgInit", eventHandlers.onInit);
          container.removeEventListener(
            "lgBeforeSlide",
            eventHandlers.onBeforeSlide,
          );
          container.removeEventListener(
            "lgAfterSlide",
            eventHandlers.onAfterSlide,
          );
          container.removeEventListener(
            "lgAfterClose",
            eventHandlers.onAfterClose,
          );
        }
        if (galleryRef.current) {
          try {
            galleryRef.current.destroy();
          } catch (error) {
            console.error("Error destroying gallery:", error);
          }
          galleryRef.current = null;
          galleryOpenedRef.current = false;
        }
        downloadBtnRef.current = null;
      };
    } catch (error) {
      console.error("Failed to initialize gallery:", error);
      return null;
    }

    return galleryRef.current;
  }, [photos, injectDownloadButton, onClose]);

  // Handle opening/navigating the gallery - let LightGallery manage its own state
  useEffect(() => {
    if (!isOpen) return;

    if (photos.length === 0) {
      return;
    }

    // Create gallery if it doesn't exist
    if (!galleryRef.current) {
      const gallery = createGallery();
      if (!gallery) {
        console.error("[PhotoLightbox] Failed to create gallery");
        return;
      }
    }

    try {
      const safeIndex = Math.max(0, Math.min(initialIndex, photos.length - 1));
      setCurrentIndex(safeIndex);

      // Always use openGallery - LightGallery handles duplicate calls internally
      galleryRef.current?.openGallery(safeIndex);

      // Only call onOpened for the first opening, not navigation
      if (!galleryOpenedRef.current) {
        galleryOpenedRef.current = true;
        onOpened?.();
      }
    } catch (error) {
      console.error("Failed to open gallery:", error);
    }
  }, [isOpen, initialIndex, onOpened, defaultShowInfo, photos.length]);

  // Handle closing the gallery (only when isOpen becomes false after being true)
  useEffect(() => {
    if (isOpen || !galleryOpenedRef.current || !galleryRef.current) {
      return; // Don't close if opening, never opened, or no gallery exists
    }

    try {
      galleryRef.current.closeGallery();
      galleryOpenedRef.current = false;
    } catch (error) {
      console.error("Failed to close gallery:", error);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (galleryRef.current) {
        try {
          galleryRef.current.destroy();
        } catch (error) {
          console.error("Error destroying gallery on cleanup:", error);
        }
        galleryRef.current = null;
        galleryOpenedRef.current = false;
      }
    };
  }, []);

  return <div ref={containerRef} style={{ display: "none" }} />;
};

export default PhotoLightbox;
