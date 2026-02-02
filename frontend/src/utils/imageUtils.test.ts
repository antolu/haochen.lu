/**
 * Tests for DPI-aware image selection utilities
 */

import {
  getDPICategory,
  getScreenSize,
  calculateTargetSize,
  findOptimalVariant,
  selectOptimalImage,
  DPICategory,
  ScreenSize,
  ImageUseCase,
  type DeviceContext,
} from "./imageUtils";
import type { Photo } from "../types";

// Mock photo data with various image variants
const mockPhoto: Photo = {
  id: "test-photo-123",
  title: "Test Photo",
  filename: "test.jpg",
  original_path: "/uploads/test.jpg",
  original_url: "/api/photos/test-photo-123/file",
  file_size: 2000000,
  width: 4000,
  height: 3000,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  variants: {
    thumbnail: {
      url: "/api/photos/test-photo-123/file/thumbnail",
      width: 400,
      height: 300,
      size_bytes: 25000,
      format: "webp",
    },
    small: {
      url: "/api/photos/test-photo-123/file/small",
      width: 800,
      height: 600,
      size_bytes: 75000,
      format: "webp",
    },
    medium: {
      url: "/api/photos/test-photo-123/file/medium",
      width: 1200,
      height: 900,
      size_bytes: 150000,
      format: "webp",
    },
    large: {
      url: "/api/photos/test-photo-123/file/large",
      width: 1600,
      height: 1200,
      size_bytes: 250000,
      format: "webp",
    },
    xlarge: {
      url: "/api/photos/test-photo-123/file/xlarge",
      width: 2400,
      height: 1800,
      size_bytes: 450000,
      format: "webp",
    },
  },
};

describe("DPI Detection", () => {
  test("categorizes DPI correctly", () => {
    expect(getDPICategory(1)).toBe(DPICategory.STANDARD);
    expect(getDPICategory(1.5)).toBe(DPICategory.STANDARD);
    expect(getDPICategory(2)).toBe(DPICategory.HIGH_DPI);
    expect(getDPICategory(2.5)).toBe(DPICategory.HIGH_DPI);
    expect(getDPICategory(3)).toBe(DPICategory.ULTRA_HIGH_DPI);
    expect(getDPICategory(4)).toBe(DPICategory.ULTRA_HIGH_DPI);
  });

  test("categorizes screen sizes correctly", () => {
    expect(getScreenSize(320)).toBe(ScreenSize.SMALL);
    expect(getScreenSize(600)).toBe(ScreenSize.SMALL);
    expect(getScreenSize(768)).toBe(ScreenSize.MEDIUM);
    expect(getScreenSize(1200)).toBe(ScreenSize.LARGE);
    expect(getScreenSize(1920)).toBe(ScreenSize.XLARGE);
  });
});

describe("Target Size Calculation", () => {
  test("calculates appropriate target sizes for different use cases", () => {
    const standardContext: DeviceContext = {
      devicePixelRatio: 1,
      viewportWidth: 1200,
      viewportHeight: 800,
      connectionSpeed: "fast",
    };

    const retinaContext: DeviceContext = {
      devicePixelRatio: 2,
      viewportWidth: 1200,
      viewportHeight: 800,
      connectionSpeed: "fast",
    };

    // Thumbnail should be smaller for standard displays
    const standardThumbnail = calculateTargetSize(
      ImageUseCase.THUMBNAIL,
      standardContext,
    );
    const retinaThumbnail = calculateTargetSize(
      ImageUseCase.THUMBNAIL,
      retinaContext,
    );
    expect(retinaThumbnail).toBeGreaterThan(standardThumbnail);

    // Gallery images should scale with DPI
    const standardGallery = calculateTargetSize(
      ImageUseCase.GALLERY,
      standardContext,
    );
    const retinaGallery = calculateTargetSize(
      ImageUseCase.GALLERY,
      retinaContext,
    );
    expect(retinaGallery).toBe(standardGallery * 2);

    // Lightbox should request high quality for retina
    const retinaLightbox = calculateTargetSize(
      ImageUseCase.LIGHTBOX,
      retinaContext,
    );
    expect(retinaLightbox).toBeGreaterThan(1600); // Should request large/xlarge variants
  });

  test("respects container size when provided", () => {
    const context: DeviceContext = {
      devicePixelRatio: 2,
      viewportWidth: 1200,
      viewportHeight: 800,
      connectionSpeed: "fast",
    };

    const containerSize = { width: 500, height: 300 };
    const targetSize = calculateTargetSize(
      ImageUseCase.GALLERY,
      context,
      containerSize,
    );

    // Should use container size (500px) * DPI (2x) = 1000px
    expect(targetSize).toBe(1000);
  });
});

describe("Variant Selection", () => {
  test("selects optimal variant based on target size", () => {
    const variants = mockPhoto.variants!;

    // Small target should select thumbnail or small
    expect(findOptimalVariant(variants, 300)).toBe("thumbnail");
    expect(findOptimalVariant(variants, 600)).toBe("small");

    // Medium target should select medium
    expect(findOptimalVariant(variants, 1000)).toBe("medium");

    // Large target should select large or xlarge
    expect(findOptimalVariant(variants, 1500)).toBe("large");
    expect(findOptimalVariant(variants, 2000)).toBe("xlarge");
  });

  test("handles slow connections by preferring smaller images", () => {
    const variants = mockPhoto.variants!;

    // With slow connection, should cap at 800px even for large targets
    expect(findOptimalVariant(variants, 1500, "slow")).toBe("small");
    expect(findOptimalVariant(variants, 2000, "slow")).toBe("small");
  });

  test("gracefully handles missing variants", () => {
    const limitedVariants = {
      small: mockPhoto.variants!.small,
      large: mockPhoto.variants!.large,
    };

    // Should select best available option
    expect(findOptimalVariant(limitedVariants, 300)).toBe("small");
    expect(findOptimalVariant(limitedVariants, 1500)).toBe("large");
  });
});

describe("Complete Image Selection", () => {
  // Mock window for testing
  const mockWindow = {
    devicePixelRatio: 2,
    innerWidth: 1200,
    innerHeight: 800,
  };

  beforeEach(() => {
    Object.defineProperty(window, "devicePixelRatio", {
      writable: true,
      value: mockWindow.devicePixelRatio,
    });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: mockWindow.innerWidth,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      value: mockWindow.innerHeight,
    });
  });

  test("selects appropriate variants for different use cases on retina display", () => {
    // Thumbnail usage - should prefer small for retina
    const thumbnailSelection = selectOptimalImage(
      mockPhoto,
      ImageUseCase.THUMBNAIL,
    );
    expect(thumbnailSelection.selectedVariant).toBe("small");
    expect(thumbnailSelection.url).toBe(
      "/api/photos/test-photo-123/file/small",
    );

    // Gallery usage - should prefer medium/large for retina
    const gallerySelection = selectOptimalImage(
      mockPhoto,
      ImageUseCase.GALLERY,
    );
    expect(["medium", "large"].includes(gallerySelection.selectedVariant)).toBe(
      true,
    );

    // Lightbox usage - should prefer xlarge for retina
    const lightboxSelection = selectOptimalImage(
      mockPhoto,
      ImageUseCase.LIGHTBOX,
    );
    expect(
      ["large", "xlarge"].includes(lightboxSelection.selectedVariant),
    ).toBe(true);
  });

  test("generates proper srcset and sizes attributes", () => {
    const selection = selectOptimalImage(mockPhoto, ImageUseCase.GALLERY);

    expect(selection.srcset).toBeDefined();
    expect(selection.srcset).toContain("400w");
    expect(selection.srcset).toContain("800w");
    expect(selection.srcset).toContain("1200w");

    expect(selection.sizes).toBeDefined();
    expect(selection.sizes).toContain("max-width");
  });

  test("provides fallback URLs", () => {
    const selection = selectOptimalImage(mockPhoto, ImageUseCase.GALLERY);

    expect(selection.fallbackUrl).toBeDefined();
    expect(selection.fallbackUrl).toContain("/api/photos/test-photo-123/file/");
  });
});

describe("Standard Display Behavior", () => {
  beforeEach(() => {
    Object.defineProperty(window, "devicePixelRatio", {
      writable: true,
      value: 1,
    });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1200,
    });
  });

  test("selects smaller variants for standard displays", () => {
    // Gallery usage on standard display should prefer smaller variants
    const gallerySelection = selectOptimalImage(
      mockPhoto,
      ImageUseCase.GALLERY,
    );
    expect(["small", "medium"].includes(gallerySelection.selectedVariant)).toBe(
      true,
    );

    // Lightbox on standard display should still get good quality but not necessarily xlarge
    const lightboxSelection = selectOptimalImage(
      mockPhoto,
      ImageUseCase.LIGHTBOX,
    );
    expect(
      ["medium", "large", "xlarge"].includes(lightboxSelection.selectedVariant),
    ).toBe(true);
  });
});

describe("Mobile Device Behavior", () => {
  beforeEach(() => {
    Object.defineProperty(window, "devicePixelRatio", {
      writable: true,
      value: 3, // iPhone-style ultra-high DPI
    });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 390, // iPhone width
    });
  });

  test("provides appropriate quality for mobile ultra-high DPI", () => {
    // Even on small screen, high DPI should get good quality variants
    const gallerySelection = selectOptimalImage(
      mockPhoto,
      ImageUseCase.GALLERY,
    );

    // Should select at least medium due to 3x DPI
    expect(
      ["medium", "large", "xlarge"].includes(gallerySelection.selectedVariant),
    ).toBe(true);
  });
});

console.log("DPI-aware image selection tests completed");
