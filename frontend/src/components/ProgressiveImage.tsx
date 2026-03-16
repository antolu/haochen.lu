import React, { useState, useEffect } from "react";
import {
  selectOptimalImage,
  selectPlaceholderVariant,
  ImageUseCase,
  PhotoLike,
} from "../utils/imageUtils";

interface ProgressiveImageProps {
  photo: PhotoLike;
  useCase: ImageUseCase;
  alt?: string;
  className?: string;
  containerSize?: { width: number; height: number };
  style?: React.CSSProperties;
}

/**
 * Adaptive Progressive Image component with blur-up transition
 */
const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  photo,
  useCase,
  alt = "",
  className = "",
  containerSize,
  style,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  // Select optimal full image
  const optimal = selectOptimalImage(photo, useCase, containerSize);

  // Select adaptive placeholder
  const placeholder = selectPlaceholderVariant(useCase, photo.variants ?? {});

  useEffect(() => {
    // Check if the optimal URL is already cached by browser
    const img = new Image();
    img.src = optimal.url;
    if (img.complete) {
      if (!isLoaded) {
        requestAnimationFrame(() => setIsLoaded(true));
      }
    } else {
      if (isLoaded) {
        requestAnimationFrame(() => setIsLoaded(false));
      }
    }
  }, [optimal.url, isLoaded]);

  return (
    <div
      className={`relative transition-all duration-500 overflow-hidden ${className}`}
    >
      {/* Placeholder Image (blurred) */}
      {!isLoaded && placeholder.url && (
        <img
          src={placeholder.url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 transition-opacity duration-500"
          style={style}
          aria-hidden="true"
        />
      )}

      {/* Full Resolution Image */}
      <img
        src={optimal.url}
        srcSet={optimal.srcset}
        sizes={optimal.sizes}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-700 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        style={style}
        loading="lazy"
      />
    </div>
  );
};

export default ProgressiveImage;
