/**
 * Image optimization utilities for DPI-aware and responsive image selection
 */

import type { Photo } from '../types';

export interface DeviceContext {
  devicePixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
  connectionSpeed?: 'slow' | 'fast' | 'unknown';
}

export interface ImageVariant {
  path: string;
  filename: string;
  url?: string;
  width: number;
  height: number;
  size_bytes: number;
  format: string;
}

export interface OptimalImageSelection {
  selectedVariant: string;
  url: string;
  fallbackUrl?: string;
  srcset?: string;
  sizes?: string;
}

/**
 * Device DPI categories for image optimization
 */
export const DPICategory = {
  STANDARD: 'standard', // 1x displays
  HIGH_DPI: 'high-dpi', // 2x displays (MacBook, iPad)
  ULTRA_HIGH_DPI: 'ultra-high-dpi', // 3x+ displays (iPhone Pro)
} as const;
export type DPICategory = (typeof DPICategory)[keyof typeof DPICategory];

/**
 * Screen size categories for responsive selection
 */
export const ScreenSize = {
  SMALL: 'small', // < 640px (mobile)
  MEDIUM: 'medium', // 640px - 1024px (tablet)
  LARGE: 'large', // 1024px - 1536px (desktop)
  XLARGE: 'xlarge', // > 1536px (large desktop)
} as const;
export type ScreenSize = (typeof ScreenSize)[keyof typeof ScreenSize];

/**
 * Image use cases with different quality requirements
 */
export const ImageUseCase = {
  THUMBNAIL: 'thumbnail', // Grid thumbnails, previews
  GALLERY: 'gallery', // Main gallery display
  LIGHTBOX: 'lightbox', // Full-screen viewing
  HERO: 'hero', // Hero/banner images
  ADMIN: 'admin', // Admin interface
} as const;
export type ImageUseCase = (typeof ImageUseCase)[keyof typeof ImageUseCase];

/**
 * Detects current device context
 */
export const getDeviceContext = (): DeviceContext => {
  if (typeof window === 'undefined') {
    // SSR fallback
    return {
      devicePixelRatio: 1,
      viewportWidth: 1200,
      viewportHeight: 800,
      connectionSpeed: 'unknown',
    };
  }

  return {
    devicePixelRatio: window.devicePixelRatio || 1,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    connectionSpeed: getConnectionSpeed(),
  };
};

/**
 * Detects network connection speed (simplified)
 */
const getConnectionSpeed = (): 'slow' | 'fast' | 'unknown' => {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return 'unknown';
  }

  const connection = (navigator as unknown as { connection?: { effectiveType?: string } })
    .connection;
  if (!connection) return 'unknown';

  // Simplified classification based on effective connection type
  const slowConnections = ['slow-2g', '2g', '3g'];
  const effectiveType = connection.effectiveType;

  if (effectiveType && slowConnections.includes(effectiveType)) {
    return 'slow';
  }

  return 'fast';
};

/**
 * Categorizes device pixel ratio
 */
export const getDPICategory = (devicePixelRatio: number): DPICategory => {
  if (devicePixelRatio >= 3) return DPICategory.ULTRA_HIGH_DPI;
  if (devicePixelRatio >= 2) return DPICategory.HIGH_DPI;
  return DPICategory.STANDARD;
};

/**
 * Categorizes screen size
 */
export const getScreenSize = (viewportWidth: number): ScreenSize => {
  if (viewportWidth < 640) return ScreenSize.SMALL;
  if (viewportWidth < 1024) return ScreenSize.MEDIUM;
  if (viewportWidth < 1536) return ScreenSize.LARGE;
  return ScreenSize.XLARGE;
};

/**
 * Calculates target image size based on use case and context
 */
export const calculateTargetSize = (
  useCase: ImageUseCase,
  context: DeviceContext,
  containerSize?: { width: number; height: number }
): number => {
  const { devicePixelRatio, viewportWidth } = context;
  const screenSize = getScreenSize(viewportWidth);

  // Base target sizes for different use cases and screen sizes
  const targetSizes = {
    [ImageUseCase.THUMBNAIL]: {
      [ScreenSize.SMALL]: 200,
      [ScreenSize.MEDIUM]: 250,
      [ScreenSize.LARGE]: 300,
      [ScreenSize.XLARGE]: 350,
    },
    [ImageUseCase.GALLERY]: {
      [ScreenSize.SMALL]: 400,
      [ScreenSize.MEDIUM]: 600,
      [ScreenSize.LARGE]: 800,
      [ScreenSize.XLARGE]: 1000,
    },
    [ImageUseCase.LIGHTBOX]: {
      [ScreenSize.SMALL]: 800,
      [ScreenSize.MEDIUM]: 1200,
      [ScreenSize.LARGE]: 1600,
      [ScreenSize.XLARGE]: 2400,
    },
    [ImageUseCase.HERO]: {
      [ScreenSize.SMALL]: 600,
      [ScreenSize.MEDIUM]: 1000,
      [ScreenSize.LARGE]: 1400,
      [ScreenSize.XLARGE]: 1800,
    },
    [ImageUseCase.ADMIN]: {
      [ScreenSize.SMALL]: 300,
      [ScreenSize.MEDIUM]: 400,
      [ScreenSize.LARGE]: 500,
      [ScreenSize.XLARGE]: 600,
    },
  };

  // Get base target size
  let targetSize = targetSizes[useCase][screenSize];

  // Use container size if provided
  if (containerSize) {
    targetSize = Math.max(containerSize.width, containerSize.height);
  }

  // Apply device pixel ratio multiplier
  return Math.ceil(targetSize * devicePixelRatio);
};

/**
 * Finds the best variant for a given target size
 */
export const findOptimalVariant = (
  variants: Record<string, ImageVariant>,
  targetSize: number,
  connectionSpeed: 'slow' | 'fast' | 'unknown' = 'unknown'
): string => {
  const variantEntries = Object.entries(variants);

  if (variantEntries.length === 0) {
    return 'original';
  }

  // Sort variants by width
  const sortedVariants = variantEntries.sort(([, a], [, b]) => a.width - b.width);

  // For slow connections, prefer smaller images
  if (connectionSpeed === 'slow') {
    targetSize = Math.min(targetSize, 800);
  }

  // Find the smallest variant that meets our target size
  let bestVariant = sortedVariants[0][0]; // Start with smallest

  for (const [variantName, variant] of sortedVariants) {
    if (variant.width >= targetSize) {
      bestVariant = variantName;
      break;
    }
    // Keep updating to larger variants until we find one that's big enough
    bestVariant = variantName;
  }

  return bestVariant;
};

/**
 * Generates srcset string for responsive images
 */
export const generateSrcSet = (variants: Record<string, ImageVariant>): string => {
  const variantEntries = Object.entries(variants);

  return variantEntries
    .filter(([, variant]) => variant.url) // Only include variants with URLs
    .map(([, variant]) => `${variant.url} ${variant.width}w`)
    .join(', ');
};

/**
 * Generates sizes attribute for responsive images
 */
export const generateSizesAttribute = (useCase: ImageUseCase): string => {
  // Default sizes based on use case
  const defaultSizes = {
    [ImageUseCase.THUMBNAIL]:
      '(max-width: 640px) 200px, (max-width: 1024px) 250px, (max-width: 1536px) 300px, 350px',
    [ImageUseCase.GALLERY]:
      '(max-width: 640px) 400px, (max-width: 1024px) 600px, (max-width: 1536px) 800px, 1000px',
    [ImageUseCase.LIGHTBOX]:
      '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, (max-width: 1536px) 80vw, 70vw',
    [ImageUseCase.HERO]:
      '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, (max-width: 1536px) 90vw, 80vw',
    [ImageUseCase.ADMIN]: '(max-width: 640px) 300px, (max-width: 1024px) 400px, 500px',
  };

  return defaultSizes[useCase];
};

/**
 * Main function to select optimal image for current context
 */
export const selectOptimalImage = (
  photo: Photo,
  useCase: ImageUseCase,
  containerSize?: { width: number; height: number }
): OptimalImageSelection => {
  const context = getDeviceContext();
  const variants = photo.variants || {};

  // Calculate target size based on context and use case
  const targetSize = calculateTargetSize(useCase, context, containerSize);

  // Find optimal variant
  const selectedVariant = findOptimalVariant(variants, targetSize, context.connectionSpeed);

  // Get URLs with proper fallbacks
  const selectedUrl =
    variants[selectedVariant]?.url || photo.original_url || `/uploads/${photo.filename}`;
  const fallbackUrl =
    variants.small?.url ||
    variants.thumbnail?.url ||
    photo.original_url ||
    `/uploads/${photo.filename}`;

  // Generate responsive attributes
  const srcset = Object.keys(variants).length > 1 ? generateSrcSet(variants) : undefined;
  const sizes = Object.keys(variants).length > 1 ? generateSizesAttribute(useCase) : undefined;

  return {
    selectedVariant,
    url: selectedUrl,
    fallbackUrl,
    srcset,
    sizes,
  };
};

/**
 * Simplified helper for common use cases
 */
export const getOptimalImageUrl = (
  photo: Photo,
  useCase: ImageUseCase,
  containerSize?: { width: number; height: number }
): string => {
  return selectOptimalImage(photo, useCase, containerSize).url;
};

/**
 * Hook-style helper for React components
 */
export const useOptimalImage = (
  photo: Photo,
  useCase: ImageUseCase,
  containerSize?: { width: number; height: number }
) => {
  // In a real implementation, this could be a proper React hook with state
  // For now, we'll just return the selection
  return selectOptimalImage(photo, useCase, containerSize);
};

/**
 * Debug helper to understand image selection
 */
export const debugImageSelection = (
  photo: Photo,
  useCase: ImageUseCase,
  containerSize?: { width: number; height: number }
): object => {
  const context = getDeviceContext();
  const targetSize = calculateTargetSize(useCase, context, containerSize);
  const selection = selectOptimalImage(photo, useCase, containerSize);

  return {
    context,
    useCase,
    targetSize,
    selection,
    availableVariants: Object.keys(photo.variants || {}),
    deviceInfo: {
      dpiCategory: getDPICategory(context.devicePixelRatio),
      screenSize: getScreenSize(context.viewportWidth),
      isHighDPI: context.devicePixelRatio >= 2,
    },
  };
};
