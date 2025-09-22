/**
 * Map utilities for handling high-DPI displays and tile configuration
 */

export interface TileConfig {
  url: string;
  tileSize: number;
  zoomOffset: number;
  attribution: string;
}

/**
 * Detects if the current display is high-DPI (retina)
 */
export const isRetinaDisplay = (): boolean => {
  return window.devicePixelRatio >= 2;
};

/**
 * Cached retina detection result to avoid repeated calculations
 */
let cachedRetinaResult: boolean | null = null;

export const getCachedRetinaDetection = (): boolean => {
  cachedRetinaResult ??= isRetinaDisplay();
  return cachedRetinaResult;
};

/**
 * Gets the optimal tile configuration based on display capabilities
 */
export const getTileConfig = (): TileConfig => {
  const isRetina = getCachedRetinaDetection();

  if (isRetina) {
    // For retina displays, use 512x512 tiles with zoom offset
    // This makes standard 256x256 tiles render crisp at 512x512
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileSize: 512,
      zoomOffset: -1,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };
  } else {
    // For standard displays, use normal 256x256 tiles
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      tileSize: 256,
      zoomOffset: 0,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };
  }
};

/**
 * Alternative high-quality tile providers for enhanced display quality
 */
export const getHighQualityTileConfig = (): TileConfig => {
  const isRetina = getCachedRetinaDetection();

  // Use Mapbox-style URL pattern that supports retina detection
  // Note: This would require a Mapbox API key in production
  const baseUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}';
  const retinaUrl = isRetina ? `${baseUrl}@2x.png` : `${baseUrl}.png`;

  return {
    url: retinaUrl,
    tileSize: isRetina ? 512 : 256,
    zoomOffset: isRetina ? -1 : 0,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  };
};

/**
 * Gets optimized marker icon configuration for high-DPI displays
 */
export const getOptimizedMarkerIcon = (size: 'small' | 'medium' | 'large' = 'medium') => {
  const sizeConfig = {
    small: {
      iconSize: [16, 25] as [number, number],
      shadowSize: [25, 25] as [number, number],
    },
    medium: {
      iconSize: [20, 32] as [number, number],
      shadowSize: [32, 32] as [number, number],
    },
    large: {
      iconSize: [25, 41] as [number, number],
      shadowSize: [41, 41] as [number, number],
    },
  };

  const config = sizeConfig[size];

  return {
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: config.iconSize,
    iconAnchor: [config.iconSize[0] / 2, config.iconSize[1]] as [number, number],
    popupAnchor: [0, -config.iconSize[1]] as [number, number],
    shadowSize: config.shadowSize,
    shadowAnchor: [config.shadowSize[0] / 2, config.shadowSize[1]] as [number, number],
  };
};

/**
 * Calculates optimal zoom level adjustments for different display types
 */
export const getOptimalZoom = (baseZoom: number): number => {
  // For retina displays, we might want to increase zoom by 1 for better detail
  // since we're using zoomOffset: -1, this balances out to the same effective zoom
  return baseZoom;
};

/**
 * Preloads retina detection on module load for better performance
 */
if (typeof window !== 'undefined') {
  // Trigger initial detection
  getCachedRetinaDetection();

  // Update detection if display configuration changes
  window.addEventListener('resize', () => {
    cachedRetinaResult = null;
    getCachedRetinaDetection();
  });
}
