/**
 * Debug utility to test image selection on different device configurations
 */

import { selectOptimalImage, debugImageSelection, ImageUseCase } from './imageUtils';
import type { Photo } from '../types';

// Mock photo for testing
const testPhoto: Photo = {
  id: 'debug-photo',
  title: 'Debug Test Photo',
  filename: 'debug.jpg',
  original_path: '/uploads/debug.jpg',
  original_url: '/api/photos/debug-photo/file',
  file_size: 2000000,
  width: 4000,
  height: 3000,
  featured: false,
  view_count: 0,
  order: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  variants: {
    thumbnail: {
      path: '/compressed/debug-thumbnail.webp',
      filename: 'debug-thumbnail.webp',
      url: '/api/photos/debug-photo/file/thumbnail',
      width: 400,
      height: 300,
      size_bytes: 25000,
      format: 'webp',
    },
    small: {
      path: '/compressed/debug-small.webp',
      filename: 'debug-small.webp',
      url: '/api/photos/debug-photo/file/small',
      width: 800,
      height: 600,
      size_bytes: 75000,
      format: 'webp',
    },
    medium: {
      path: '/compressed/debug-medium.webp',
      filename: 'debug-medium.webp',
      url: '/api/photos/debug-photo/file/medium',
      width: 1200,
      height: 900,
      size_bytes: 150000,
      format: 'webp',
    },
    large: {
      path: '/compressed/debug-large.webp',
      filename: 'debug-large.webp',
      url: '/api/photos/debug-photo/file/large',
      width: 1600,
      height: 1200,
      size_bytes: 250000,
      format: 'webp',
    },
    xlarge: {
      path: '/compressed/debug-xlarge.webp',
      filename: 'debug-xlarge.webp',
      url: '/api/photos/debug-photo/file/xlarge',
      width: 2400,
      height: 1800,
      size_bytes: 450000,
      format: 'webp',
    },
  },
};

interface DeviceTest {
  name: string;
  devicePixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
}

const testDevices: DeviceTest[] = [
  { name: 'Desktop Standard', devicePixelRatio: 1, viewportWidth: 1920, viewportHeight: 1080 },
  { name: 'Desktop High-DPI', devicePixelRatio: 2, viewportWidth: 1920, viewportHeight: 1080 },
  { name: 'MacBook Pro 13"', devicePixelRatio: 2, viewportWidth: 1440, viewportHeight: 900 },
  { name: 'MacBook Pro 16"', devicePixelRatio: 2, viewportWidth: 1728, viewportHeight: 1117 },
  { name: 'iPad Pro', devicePixelRatio: 2, viewportWidth: 1024, viewportHeight: 1366 },
  { name: 'iPad', devicePixelRatio: 2, viewportWidth: 768, viewportHeight: 1024 },
  { name: 'iPhone 15 Pro', devicePixelRatio: 3, viewportWidth: 393, viewportHeight: 852 },
  { name: 'iPhone SE', devicePixelRatio: 3, viewportWidth: 375, viewportHeight: 667 },
  { name: 'Android Phone', devicePixelRatio: 2.75, viewportWidth: 412, viewportHeight: 915 },
  { name: 'Surface Pro', devicePixelRatio: 1.5, viewportWidth: 1368, viewportHeight: 912 },
];

/**
 * Mock window properties for testing
 */
const mockDevice = (device: DeviceTest) => {
  Object.defineProperty(window, 'devicePixelRatio', {
    writable: true,
    value: device.devicePixelRatio,
  });
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    value: device.viewportWidth,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    value: device.viewportHeight,
  });
};

/**
 * Test image selection across different devices and use cases
 */
export const testImageSelectionAcrossDevices = () => {
  const results: {
    device: string;
    dpr: number;
    viewport: string;
    useCase: ImageUseCase;
    selectedVariant: string;
    targetSize: number;
    actualSize?: number;
    fileSize?: number;
  }[] = [];

  console.group('🖼️  DPI-Aware Image Selection Test Results');

  testDevices.forEach(device => {
    // Mock the device
    mockDevice(device);

    console.group(
      `📱 ${device.name} (${device.devicePixelRatio}x DPI, ${device.viewportWidth}×${device.viewportHeight})`
    );

    Object.values(ImageUseCase).forEach(useCase => {
      const debug = debugImageSelection(testPhoto, useCase) as {
        targetSize: number;
        context: unknown;
        useCase: unknown;
        selection: unknown;
        availableVariants: string[];
        deviceInfo: unknown;
      };
      const selection = selectOptimalImage(testPhoto, useCase);

      console.log(`${useCase}:`, {
        selectedVariant: selection.selectedVariant,
        targetSize: debug.targetSize,
        actualSize: testPhoto.variants?.[selection.selectedVariant]?.width || 'N/A',
        fileSize: `${Math.round((testPhoto.variants?.[selection.selectedVariant]?.size_bytes || 0) / 1024)}KB`,
        url: selection.url,
      });

      results.push({
        device: device.name,
        dpr: device.devicePixelRatio,
        viewport: `${device.viewportWidth}×${device.viewportHeight}`,
        useCase,
        selectedVariant: selection.selectedVariant,
        targetSize: debug.targetSize,
        actualSize: testPhoto.variants?.[selection.selectedVariant]?.width,
        fileSize: testPhoto.variants?.[selection.selectedVariant]?.size_bytes,
      });
    });

    console.groupEnd();
  });

  console.groupEnd();

  return results;
};

/**
 * Test bandwidth efficiency compared to static selection
 */
export const testBandwidthEfficiency = () => {
  console.group('📊 Bandwidth Efficiency Analysis');

  // Static selection (what we used before)
  const staticSelection = {
    thumbnail: 'small',
    gallery: 'small',
    lightbox: 'xlarge',
    hero: 'large',
    admin: 'thumbnail',
  };

  let totalStaticBytes = 0;
  let totalDynamicBytes = 0;

  testDevices.forEach(device => {
    mockDevice(device);

    Object.values(ImageUseCase).forEach(useCase => {
      const staticVariant = staticSelection[useCase as keyof typeof staticSelection];
      const staticBytes = testPhoto.variants?.[staticVariant]?.size_bytes || 0;

      const dynamicSelection = selectOptimalImage(testPhoto, useCase);
      const dynamicBytes = testPhoto.variants?.[dynamicSelection.selectedVariant]?.size_bytes || 0;

      totalStaticBytes += staticBytes;
      totalDynamicBytes += dynamicBytes;
    });
  });

  const savings = totalStaticBytes - totalDynamicBytes;
  const percentSavings = ((savings / totalStaticBytes) * 100).toFixed(1);

  console.log('Total bandwidth comparison:', {
    staticApproach: `${Math.round(totalStaticBytes / 1024 / 1024)}MB`,
    dynamicApproach: `${Math.round(totalDynamicBytes / 1024 / 1024)}MB`,
    savings: `${Math.round(savings / 1024 / 1024)}MB (${percentSavings}%)`,
  });

  console.groupEnd();

  return {
    staticBytes: totalStaticBytes,
    dynamicBytes: totalDynamicBytes,
    savings,
    percentSavings: parseFloat(percentSavings),
  };
};

/**
 * Test quality improvements for high-DPI displays
 */
export const testHighDPIQuality = () => {
  console.group('✨ High-DPI Quality Analysis');

  const standardDevice = {
    name: 'Standard Monitor',
    devicePixelRatio: 1,
    viewportWidth: 1920,
    viewportHeight: 1080,
  };
  const retinaDevice = {
    name: 'Retina Display',
    devicePixelRatio: 2,
    viewportWidth: 1920,
    viewportHeight: 1080,
  };
  const ultraDevice = {
    name: 'Ultra High-DPI',
    devicePixelRatio: 3,
    viewportWidth: 390,
    viewportHeight: 844,
  };

  [standardDevice, retinaDevice, ultraDevice].forEach(device => {
    mockDevice(device);

    console.group(`🖥️  ${device.name} (${device.devicePixelRatio}x)`);

    Object.values(ImageUseCase).forEach(useCase => {
      const selection = selectOptimalImage(testPhoto, useCase);
      const variant = testPhoto.variants?.[selection.selectedVariant];

      if (variant) {
        const pixelDensity = variant.width / device.viewportWidth;
        const qualityScore = Math.min(pixelDensity * device.devicePixelRatio, 3);

        console.log(`${useCase}:`, {
          variant: selection.selectedVariant,
          resolution: `${variant.width}×${variant.height}`,
          pixelDensity: `${pixelDensity.toFixed(2)}x`,
          qualityScore: `${qualityScore.toFixed(2)}/3`,
          sharpness:
            qualityScore >= 2 ? '🔥 Crisp' : qualityScore >= 1.5 ? '✅ Good' : '⚠️  Blurry',
        });
      }
    });

    console.groupEnd();
  });

  console.groupEnd();
};

// Auto-run tests in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Run tests after a short delay to avoid interfering with app startup
  setTimeout(() => {
    testImageSelectionAcrossDevices();
    testBandwidthEfficiency();
    testHighDPIQuality();
  }, 2000);
}

export default {
  testImageSelectionAcrossDevices,
  testBandwidthEfficiency,
  testHighDPIQuality,
};
