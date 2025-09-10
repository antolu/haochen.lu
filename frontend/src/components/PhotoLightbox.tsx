import React from 'react';
import { Gallery, Item } from 'react-photoswipe-gallery';
import 'photoswipe/dist/photoswipe.css';
import type { Photo } from '../types';

interface PhotoLightboxProps {
  photos: Photo[];
  children: React.ReactNode;
  options?: {
    bgOpacity?: number;
    showHideOpacity?: boolean;
    showHideAnimationType?: 'fade' | 'zoom' | 'none';
  };
}

interface PhotoLightboxItemProps {
  photo: Photo;
  width?: number;
  height?: number;
  children: React.ReactNode;
}

const PhotoLightboxItem: React.FC<PhotoLightboxItemProps> = ({
  photo,
  width,
  height,
  children,
}) => {
  // Use the highest quality image available
  const fullImageUrl = photo.webp_path || photo.original_path;

  // Fallback dimensions if not provided
  const imageWidth = width || photo.width || 1200;
  const imageHeight = height || photo.height || 800;

  // Generate caption with EXIF data
  const generateCaption = () => {
    const parts = [];

    if (photo.title) {
      parts.push(
        `<h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: white;">${photo.title}</h3>`
      );
    }

    if (photo.description) {
      parts.push(
        `<p style="font-size: 14px; margin: 0 0 12px 0; color: #e5e7eb;">${photo.description}</p>`
      );
    }

    // Camera info
    const cameraInfo = [];
    if (photo.camera_make && photo.camera_model) {
      cameraInfo.push(`${photo.camera_make} ${photo.camera_model}`);
    } else if (photo.camera_model) {
      cameraInfo.push(photo.camera_model);
    }

    if (photo.lens) {
      cameraInfo.push(photo.lens);
    }

    if (cameraInfo.length > 0) {
      parts.push(
        `<p style="font-size: 13px; margin: 0 0 8px 0; color: #d1d5db;">${cameraInfo.join(' • ')}</p>`
      );
    }

    // Technical info
    const techInfo = [];
    if (photo.aperture) {
      techInfo.push(`f/${photo.aperture}`);
    }
    if (photo.shutter_speed) {
      techInfo.push(`${photo.shutter_speed}s`);
    }
    if (photo.iso) {
      techInfo.push(`ISO ${photo.iso}`);
    }
    if (photo.focal_length) {
      techInfo.push(`${photo.focal_length}mm`);
    }

    if (techInfo.length > 0) {
      parts.push(
        `<p style="font-size: 12px; margin: 0 0 8px 0; color: #9ca3af;">${techInfo.join(' • ')}</p>`
      );
    }

    // Date and location
    if (photo.date_taken) {
      const date = new Date(photo.date_taken).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      parts.push(`<p style="font-size: 12px; margin: 0; color: #9ca3af;">${date}</p>`);
    }

    if (photo.location_name) {
      parts.push(
        `<p style="font-size: 12px; margin: 4px 0 0 0; color: #9ca3af;">📍 ${photo.location_name}</p>`
      );
    }

    return parts.join('');
  };

  return (
    <Item
      original={fullImageUrl}
      thumbnail={photo.thumbnail_path || fullImageUrl}
      width={imageWidth}
      height={imageHeight}
      caption={generateCaption()}
      alt={photo.title || 'Photo'}
    >
      {({ ref, open }) => (
        <div ref={ref} onClick={open} style={{ cursor: 'pointer' }}>
          {children}
        </div>
      )}
    </Item>
  );
};

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ photos, children, options = {} }) => {
  const defaultOptions = {
    bgOpacity: 0.9,
    showHideOpacity: true,
    showHideAnimationType: 'zoom' as const,
    closeOnVerticalDrag: true,
    pinchToClose: true,
    ...options,
  };

  // Custom PhotoSwipe options for better UX

  return (
    <Gallery
      options={{
        ...defaultOptions,
        // Custom styling for the lightbox
        dataSource: photos.map((photo, index) => ({
          src: photo.webp_path || photo.original_path,
          width: photo.width || 1200,
          height: photo.height || 800,
          alt: photo.title || `Photo ${index + 1}`,
          caption: (() => {
            const parts = [];

            if (photo.title) {
              parts.push(
                `<h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: white;">${photo.title}</h3>`
              );
            }

            if (photo.description) {
              parts.push(
                `<p style="font-size: 14px; margin: 0 0 12px 0; color: #e5e7eb; line-height: 1.4;">${photo.description}</p>`
              );
            }

            // Camera and technical info
            const techParts = [];
            if (photo.camera_make && photo.camera_model) {
              techParts.push(`${photo.camera_make} ${photo.camera_model}`);
            }

            const settings = [];
            if (photo.aperture) settings.push(`f/${photo.aperture}`);
            if (photo.shutter_speed) settings.push(`${photo.shutter_speed}s`);
            if (photo.iso) settings.push(`ISO ${photo.iso}`);
            if (photo.focal_length) settings.push(`${photo.focal_length}mm`);

            if (settings.length > 0) {
              techParts.push(settings.join(' • '));
            }

            if (techParts.length > 0) {
              parts.push(
                `<p style="font-size: 12px; margin: 0; color: #9ca3af;">${techParts.join('<br>')}</p>`
              );
            }

            return parts.join('');
          })(),
        })),
        // Enhanced UI elements
        zoom: true,
        close: true,
        counter: true,
        arrowPrev: true,
        arrowNext: true,
        // Custom CSS classes
        mainClass: 'pswp--custom-bg',
        // Responsive breakpoints
        thumbSelector: '.pswp__thumb',
      }}
      // Custom styles
      onOpen={pswp => {
        // Add custom styles when lightbox opens
        const style = document.createElement('style');
        style.innerHTML = `
          .pswp--custom-bg .pswp__bg {
            background: rgba(0, 0, 0, ${defaultOptions.bgOpacity});
            backdrop-filter: blur(8px);
          }
          .pswp__caption {
            background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
            padding: 20px;
            border-radius: 12px 12px 0 0;
            margin-bottom: 0;
          }
          .pswp__caption h3 {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .pswp__button {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(8px);
            border-radius: 50%;
            transition: all 0.2s ease;
          }
          .pswp__button:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
          }
          .pswp__counter {
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(8px);
            border-radius: 16px;
            padding: 6px 12px;
            font-size: 14px;
            font-weight: 500;
          }
          .pswp__top-bar {
            background: linear-gradient(rgba(0, 0, 0, 0.3), transparent);
            padding: 16px;
          }
          .pswp__img {
            border-radius: 8px;
          }
        `;
        document.head.appendChild(style);

        // Remove style when lightbox closes
        pswp.on('close', () => {
          document.head.removeChild(style);
        });
      }}
    >
      {children}
    </Gallery>
  );
};

// Higher-order component for easy PhotoGrid integration
export const withPhotoLightbox = <P extends object>(Component: React.ComponentType<P>) => {
  return React.forwardRef<any, P & { photos: Photo[] }>((props, ref) => {
    const { photos, ...restProps } = props;

    return (
      <PhotoLightbox photos={photos}>
        <Component ref={ref} {...(restProps as P)} photos={photos} />
      </PhotoLightbox>
    );
  });
};

// Export individual item component for custom usage
export { PhotoLightboxItem };

export default PhotoLightbox;
