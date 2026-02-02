import type { Photo } from "../types";
import type { OrderByOption } from "../components/OrderBySelector";

/**
 * Photo utility functions for cache optimization and intersection analysis
 */

export interface PhotoIntersectionResult {
  intersection: Photo[];
  onlyInA: Photo[];
  onlyInB: Photo[];
  intersectionRatio: number;
}

/**
 * Analyzes photo overlap between two sets of photos
 */
export const analyzePhotoIntersection = (
  photosA: Photo[],
  photosB: Photo[],
): PhotoIntersectionResult => {
  const idsA = new Set(photosA.map((p) => p.id));
  const idsB = new Set(photosB.map((p) => p.id));

  const intersection = photosA.filter((p) => idsB.has(p.id));
  const onlyInA = photosA.filter((p) => !idsB.has(p.id));
  const onlyInB = photosB.filter((p) => !idsA.has(p.id));

  const totalUnique = idsA.size + idsB.size - intersection.length;
  const intersectionRatio =
    totalUnique > 0 ? intersection.length / totalUnique : 0;

  return {
    intersection,
    onlyInA,
    onlyInB,
    intersectionRatio,
  };
};

/**
 * Determines if cached photos should be shown immediately during order transitions
 */
export const shouldShowCachedPhotos = (
  currentPhotos: Photo[],
  cachedPhotos: Photo[],
  minIntersection = 6,
  minRatio = 0.3,
): boolean => {
  if (cachedPhotos.length < minIntersection) return false;

  const { intersectionRatio } = analyzePhotoIntersection(
    currentPhotos,
    cachedPhotos,
  );
  return intersectionRatio >= minRatio;
};

/**
 * Merges photos from different sources while preserving order and removing duplicates
 */
export const mergePhotoArrays = (
  primaryPhotos: Photo[],
  secondaryPhotos: Photo[],
  orderBy: OrderByOption,
): Photo[] => {
  const photoMap = new Map<string, Photo>();

  // Add primary photos first
  primaryPhotos.forEach((photo) => photoMap.set(photo.id, photo));

  // Add secondary photos (won't override existing)
  secondaryPhotos.forEach((photo) => {
    if (!photoMap.has(photo.id)) {
      photoMap.set(photo.id, photo);
    }
  });

  // Convert back to array and sort according to orderBy
  const mergedPhotos = Array.from(photoMap.values());

  return sortPhotosByOrder(mergedPhotos, orderBy);
};

/**
 * Sorts photos according to the specified order
 */
export const sortPhotosByOrder = (
  photos: Photo[],
  orderBy: OrderByOption,
): Photo[] => {
  const sorted = [...photos];

  switch (orderBy) {
    case "created_at":
      return sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    case "date_taken":
      return sorted.sort((a, b) => {
        const dateA = new Date(a.date_taken ?? a.created_at).getTime();
        const dateB = new Date(b.date_taken ?? b.created_at).getTime();
        return dateB - dateA;
      });

    case "order":
      return sorted.sort((a, b) => {
        // Primary sort by order field
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        // Secondary sort by date_taken/created_at for same order values
        const dateA = new Date(a.date_taken ?? a.created_at).getTime();
        const dateB = new Date(b.date_taken ?? b.created_at).getTime();
        return dateB - dateA;
      });

    default:
      return sorted;
  }
};

/**
 * Calculates which pages need to be fetched for a given photo count and page size
 */
export const calculateMissingPages = (
  _currentPhotoCount: number,
  targetPhotoCount: number,
  pageSize: number,
  loadedPages: Set<number>,
): number[] => {
  const targetPages = Math.ceil(targetPhotoCount / pageSize);
  const missingPages: number[] = [];

  for (let page = 1; page <= targetPages; page++) {
    if (!loadedPages.has(page)) {
      missingPages.push(page);
    }
  }

  return missingPages;
};

/**
 * Optimizes photo loading by determining the best strategy for order switching
 */
export interface PhotoLoadStrategy {
  useCache: boolean;
  cachedPhotos: Photo[];
  pagesToFetch: number[];
  estimatedSavings: {
    networkRequests: number;
    photosReused: number;
    percentageSaved: number;
  };
}

export const calculateLoadStrategy = (
  _currentOrder: OrderByOption,
  _newOrder: OrderByOption,
  currentPhotos: Photo[],
  cachedPhotos: Photo[],
  targetTotal: number,
  pageSize: number,
  loadedPages: Set<number>,
): PhotoLoadStrategy => {
  const intersection = analyzePhotoIntersection(currentPhotos, cachedPhotos);
  const useCache = shouldShowCachedPhotos(currentPhotos, cachedPhotos);

  const pagesToFetch: number[] = [];

  if (useCache && cachedPhotos.length > 0) {
    // Calculate pages still needed beyond cached photos
    const cachedPhotoCount = cachedPhotos.length;
    const remainingPhotos = Math.max(0, targetTotal - cachedPhotoCount);
    const pagesNeeded = Math.ceil(remainingPhotos / pageSize);

    for (let page = 1; page <= pagesNeeded; page++) {
      if (!loadedPages.has(page)) {
        pagesToFetch.push(page);
      }
    }
  } else {
    // Fetch first few pages normally
    const initialPages = Math.min(3, Math.ceil(targetTotal / pageSize));
    for (let page = 1; page <= initialPages; page++) {
      pagesToFetch.push(page);
    }
  }

  const estimatedSavings = {
    networkRequests: useCache ? Math.max(0, 3 - pagesToFetch.length) : 0,
    photosReused: intersection.intersection.length,
    percentageSaved:
      currentPhotos.length > 0
        ? (intersection.intersection.length / currentPhotos.length) * 100
        : 0,
  };

  return {
    useCache,
    cachedPhotos: useCache ? cachedPhotos : [],
    pagesToFetch,
    estimatedSavings,
  };
};

/**
 * Validates photo data consistency
 */
export const validatePhotoData = (
  photos: Photo[],
): {
  isValid: boolean;
  errors: string[];
  duplicates: string[];
} => {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const duplicates: string[] = [];

  photos.forEach((photo, index) => {
    // Check for required fields
    if (!photo.id) {
      errors.push(`Photo at index ${index} missing ID`);
    }
    if (!photo.filename) {
      errors.push(`Photo ${photo.id} missing filename`);
    }
    if (!photo.created_at) {
      errors.push(`Photo ${photo.id} missing created_at`);
    }

    // Check for duplicates
    if (photo.id) {
      if (seenIds.has(photo.id)) {
        duplicates.push(photo.id);
      } else {
        seenIds.add(photo.id);
      }
    }
  });

  return {
    isValid: errors.length === 0 && duplicates.length === 0,
    errors,
    duplicates,
  };
};
