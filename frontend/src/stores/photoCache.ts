import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type { Photo, PhotoListResponse } from "../types";
import type { OrderByOption } from "../components/OrderBySelector";

interface PhotosByOrder {
  photos: Photo[];
  total: number;
  pages: number;
  lastFetched: number;
  loadedPages: Set<number>;
}

interface PhotoCacheState {
  // Cache organized by order type
  cache: Record<OrderByOption, PhotosByOrder>;

  // Master photo index for quick lookups
  photoIndex: Map<string, Photo>;

  // Current active order
  activeOrder: OrderByOption;

  // Loading states
  isTransitioning: boolean;
  transitionFromOrder: OrderByOption | null;
}

interface PhotoCacheActions {
  // Cache management
  setPhotos: (
    orderBy: OrderByOption,
    response: PhotoListResponse,
    page: number,
  ) => void;
  appendPhotos: (orderBy: OrderByOption, response: PhotoListResponse) => void;
  updatePhoto: (photoId: string, updates: Partial<Photo>) => void;
  removePhoto: (photoId: string) => void;

  // Order switching with optimization
  switchOrder: (newOrder: OrderByOption) => {
    cachedPhotos: Photo[];
    missingPages: number[];
    shouldShowCached: boolean;
  };

  // Utility functions
  getPhotoIntersection: (
    orderA: OrderByOption,
    orderB: OrderByOption,
  ) => Photo[];
  getCachedPhotos: (orderBy: OrderByOption) => Photo[];
  clearCache: (orderBy?: OrderByOption) => void;

  // State management
  setActiveOrder: (order: OrderByOption) => void;
  setTransitioning: (transitioning: boolean, fromOrder?: OrderByOption) => void;

  // Cache validation
  isCacheValid: (orderBy: OrderByOption, maxAge?: number) => boolean;
  getCacheStats: () => {
    totalPhotos: number;
    cacheSize: Record<OrderByOption, number>;
    memoryUsage: string;
  };
}

type PhotoCacheStore = PhotoCacheState & PhotoCacheActions;

const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const PHOTOS_PER_PAGE = 24;

export const usePhotoCacheStore = create<PhotoCacheStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        cache: {
          created_at: {
            photos: [],
            total: 0,
            pages: 0,
            lastFetched: 0,
            loadedPages: new Set(),
          },
          date_taken: {
            photos: [],
            total: 0,
            pages: 0,
            lastFetched: 0,
            loadedPages: new Set(),
          },
          order: {
            photos: [],
            total: 0,
            pages: 0,
            lastFetched: 0,
            loadedPages: new Set(),
          },
        },
        photoIndex: new Map(),
        activeOrder: "created_at",
        isTransitioning: false,
        transitionFromOrder: null,

        // Actions
        setPhotos: (orderBy, response, page) => {
          set((state) => {
            const newCache = { ...state.cache };
            const orderCache = { ...newCache[orderBy] };

            if (page === 1) {
              // Replace all photos for first page
              orderCache.photos = response.photos;
              orderCache.loadedPages = new Set([1]);
            } else {
              // Append photos for subsequent pages
              const existingIds = new Set(orderCache.photos.map((p) => p.id));
              const newPhotos = response.photos.filter(
                (p) => !existingIds.has(p.id),
              );
              orderCache.photos = [...orderCache.photos, ...newPhotos];
              orderCache.loadedPages.add(page);
            }

            orderCache.total = response.total;
            orderCache.pages = response.pages;
            orderCache.lastFetched = Date.now();
            newCache[orderBy] = orderCache;

            // Update photo index
            const newPhotoIndex = new Map(state.photoIndex);
            response.photos.forEach((photo) => {
              newPhotoIndex.set(photo.id, photo);
            });

            return {
              cache: newCache,
              photoIndex: newPhotoIndex,
            };
          });
        },

        appendPhotos: (orderBy, response) => {
          const { cache } = get();
          const currentPage =
            Math.floor(cache[orderBy].photos.length / PHOTOS_PER_PAGE) + 1;
          get().setPhotos(orderBy, response, currentPage);
        },

        updatePhoto: (photoId, updates) => {
          set((state) => {
            const newCache = { ...state.cache };
            const newPhotoIndex = new Map(state.photoIndex);

            // Update in photo index
            const existingPhoto = newPhotoIndex.get(photoId);
            if (existingPhoto) {
              const updatedPhoto = { ...existingPhoto, ...updates };
              newPhotoIndex.set(photoId, updatedPhoto);

              // Update in all order caches
              Object.keys(newCache).forEach((orderKey) => {
                const orderBy = orderKey as OrderByOption;
                const orderCache = { ...newCache[orderBy] };
                const photoIndex = orderCache.photos.findIndex(
                  (p) => p.id === photoId,
                );
                if (photoIndex !== -1) {
                  orderCache.photos = [...orderCache.photos];
                  orderCache.photos[photoIndex] = updatedPhoto;
                  newCache[orderBy] = orderCache;
                }
              });
            }

            return {
              cache: newCache,
              photoIndex: newPhotoIndex,
            };
          });
        },

        removePhoto: (photoId) => {
          set((state) => {
            const newCache = { ...state.cache };
            const newPhotoIndex = new Map(state.photoIndex);

            // Remove from photo index
            newPhotoIndex.delete(photoId);

            // Remove from all order caches
            Object.keys(newCache).forEach((orderKey) => {
              const orderBy = orderKey as OrderByOption;
              const orderCache = { ...newCache[orderBy] };
              orderCache.photos = orderCache.photos.filter(
                (p) => p.id !== photoId,
              );
              orderCache.total = Math.max(0, orderCache.total - 1);
              newCache[orderBy] = orderCache;
            });

            return {
              cache: newCache,
              photoIndex: newPhotoIndex,
            };
          });
        },

        switchOrder: (newOrder) => {
          const { cache, activeOrder, photoIndex } = get();

          set({
            isTransitioning: true,
            transitionFromOrder: activeOrder,
          });

          const currentCache = cache[activeOrder];
          const newCache = cache[newOrder];

          // Find intersection of photos between orders
          const currentPhotoIds = new Set(currentCache.photos.map((p) => p.id));
          const newPhotoIds = new Set(newCache.photos.map((p) => p.id));
          const intersectionIds = [...currentPhotoIds].filter((id) =>
            newPhotoIds.has(id),
          );

          // Get cached photos that can be reused
          const cachedPhotos = intersectionIds
            .map((id) => photoIndex.get(id))
            .filter((photo): photo is Photo => Boolean(photo));

          // Determine which pages are missing
          const loadedPages = Array.from(newCache.loadedPages);
          const expectedPages = Math.ceil(newCache.total / PHOTOS_PER_PAGE);
          const missingPages = [];

          for (let page = 1; page <= Math.min(expectedPages, 3); page++) {
            if (!loadedPages.includes(page)) {
              missingPages.push(page);
            }
          }

          // Decide if we should show cached photos immediately
          const shouldShowCached =
            cachedPhotos.length >= 6 && intersectionIds.length > 0;

          return {
            cachedPhotos,
            missingPages,
            shouldShowCached,
          };
        },

        getPhotoIntersection: (orderA, orderB) => {
          const { cache, photoIndex } = get();
          const cacheA = cache[orderA];
          const cacheB = cache[orderB];

          const idsA = new Set(cacheA.photos.map((p) => p.id));
          const idsB = new Set(cacheB.photos.map((p) => p.id));
          const intersectionIds = [...idsA].filter((id) => idsB.has(id));

          return intersectionIds
            .map((id) => photoIndex.get(id))
            .filter((photo): photo is Photo => Boolean(photo));
        },

        getCachedPhotos: (orderBy) => {
          const { cache } = get();
          return cache[orderBy].photos;
        },

        clearCache: (orderBy) => {
          set((state) => {
            if (orderBy) {
              // Clear specific order cache
              const newCache = { ...state.cache };
              newCache[orderBy] = {
                photos: [],
                total: 0,
                pages: 0,
                lastFetched: 0,
                loadedPages: new Set(),
              };
              return { cache: newCache };
            } else {
              // Clear all caches
              return {
                cache: {
                  created_at: {
                    photos: [],
                    total: 0,
                    pages: 0,
                    lastFetched: 0,
                    loadedPages: new Set(),
                  },
                  date_taken: {
                    photos: [],
                    total: 0,
                    pages: 0,
                    lastFetched: 0,
                    loadedPages: new Set(),
                  },
                  order: {
                    photos: [],
                    total: 0,
                    pages: 0,
                    lastFetched: 0,
                    loadedPages: new Set(),
                  },
                },
                photoIndex: new Map(),
              };
            }
          });
        },

        setActiveOrder: (order) => {
          set({ activeOrder: order });
        },

        setTransitioning: (transitioning, fromOrder) => {
          set({
            isTransitioning: transitioning,
            transitionFromOrder: fromOrder || null,
          });
        },

        isCacheValid: (orderBy, maxAge = CACHE_MAX_AGE) => {
          const { cache } = get();
          const orderCache = cache[orderBy];
          return Date.now() - orderCache.lastFetched < maxAge;
        },

        getCacheStats: () => {
          const { cache, photoIndex } = get();
          const cacheSize = {
            created_at: cache.created_at.photos.length,
            date_taken: cache.date_taken.photos.length,
            order: cache.order.photos.length,
          };

          const totalPhotos = photoIndex.size;
          const memoryUsage = `${Math.round((totalPhotos * 50) / 1024)} KB`; // Rough estimate

          return {
            totalPhotos,
            cacheSize,
            memoryUsage,
          };
        },
      }),
      {
        name: "photo-cache-store",
        // Only persist the cache data, not the Maps or Sets
        partialize: (state) => ({
          cache: {
            created_at: {
              ...state.cache.created_at,
              loadedPages: Array.from(state.cache.created_at.loadedPages),
            },
            date_taken: {
              ...state.cache.date_taken,
              loadedPages: Array.from(state.cache.date_taken.loadedPages),
            },
            order: {
              ...state.cache.order,
              loadedPages: Array.from(state.cache.order.loadedPages),
            },
          },
          activeOrder: state.activeOrder,
        }),
        // Rehydrate the Sets and Maps
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Rebuild photoIndex from cached photos
            const photoIndex = new Map<string, Photo>();
            Object.values(state.cache).forEach((orderCache) => {
              orderCache.photos.forEach((photo) => {
                photoIndex.set(photo.id, photo);
              });
            });
            state.photoIndex = photoIndex;

            // Convert loadedPages arrays back to Sets
            Object.keys(state.cache).forEach((orderKey) => {
              const orderBy = orderKey as OrderByOption;
              const orderCache = state.cache[orderBy] as any;
              if (Array.isArray(orderCache.loadedPages)) {
                orderCache.loadedPages = new Set(orderCache.loadedPages);
              }
            });
          }
        },
      },
    ),
  ),
);

// Selector hooks for performance
export const usePhotosForOrder = (orderBy: OrderByOption) =>
  usePhotoCacheStore((state) => state.cache[orderBy].photos);

export const useCacheStats = () =>
  usePhotoCacheStore((state) => state.getCacheStats());

export const useIsTransitioning = () =>
  usePhotoCacheStore((state) => state.isTransitioning);
