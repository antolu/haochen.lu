import React, { useRef, useEffect, useCallback } from "react";
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
  initialIndex: number;
  defaultShowInfo?: boolean;
  onClose?: () => void;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  initialIndex,
  defaultShowInfo = false,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<LightGalleryInstance | null>(null);
  const downloadBtnRef = useRef<HTMLButtonElement | null>(null);

  const currentPhoto = photos[initialIndex] || photos[0];

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

      const onAfterClose = () => {
        onClose?.();
      };

      container.addEventListener("lgAfterClose", onAfterClose);

      return () => {
        if (container) {
          container.removeEventListener("lgAfterClose", onAfterClose);
        }
      };
    } catch (error) {
      console.error("Failed to initialize gallery:", error);
      return null;
    }

    return galleryRef.current;
  }, [photos, injectDownloadButton, onClose, defaultShowInfo]);

  // Create gallery on mount and open it
  useEffect(() => {
    if (photos.length === 0) {
      return;
    }

    try {
      createGallery();

      if (galleryRef.current) {
        const safeIndex = Math.max(
          0,
          Math.min(initialIndex, photos.length - 1),
        );
        galleryRef.current.openGallery(safeIndex);
      }
    } catch (error) {
      console.error("Error creating gallery:", error);
    }
  }, [createGallery, initialIndex, photos.length]);

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
      }
    };
  }, []);

  return <div ref={containerRef} style={{ display: "none" }} />;
};

export default PhotoLightbox;
