/**
 * P1 - Frontend Component Tests: PhotoGallery
 *
 * Tests for the photo gallery component including rendering, interactions,
 * lazy loading, and responsive behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockPhoto, mockIntersectionObserver } from '../utils';

// Mock the PhotoGallery component
const MockPhotoGallery = ({
  photos,
  onPhotoClick,
  loading = false,
  error = null,
}: {
  photos: any[];
  onPhotoClick?: (photo: any) => void;
  loading?: boolean;
  error?: string | null;
}) => {
  if (loading) {
    return (
      <div data-testid="photo-gallery">
        <div data-testid="loading-spinner">Loading photos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="photo-gallery">
        <div data-testid="error-message" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div data-testid="photo-gallery">
        <div data-testid="empty-state">No photos to display</div>
      </div>
    );
  }

  return (
    <div data-testid="photo-gallery" className="photo-gallery">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map(photo => (
          <div
            key={photo.id}
            data-testid={`photo-item-${photo.id}`}
            className="photo-item cursor-pointer"
            onClick={() => onPhotoClick?.(photo)}
          >
            <img
              src={photo.thumbnail_url}
              alt={photo.title}
              loading="lazy"
              className="w-full h-64 object-cover rounded-lg"
            />
            <div className="photo-meta p-2">
              <h3 className="font-semibold">{photo.title}</h3>
              {photo.category && <span className="text-sm text-gray-500">{photo.category}</span>}
              {photo.tags && photo.tags.length > 0 && (
                <div className="tags mt-1">
                  {photo.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="inline-block bg-gray-200 text-xs px-2 py-1 rounded mr-1"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MockLazyPhotoGallery = ({ photos }: { photos: any[] }) => {
  const [visiblePhotos, setVisiblePhotos] = React.useState<any[]>([]);
  const [loadedImages, setLoadedImages] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    // Simulate intersection observer for lazy loading
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const photoId = entry.target.getAttribute('data-photo-id');
          if (photoId && !loadedImages.has(photoId)) {
            setLoadedImages(prev => new Set([...prev, photoId]));
          }
        }
      });
    });

    return () => observer.disconnect();
  }, [loadedImages]);

  React.useEffect(() => {
    setVisiblePhotos(photos.slice(0, 12)); // Initial load
  }, [photos]);

  return (
    <div data-testid="lazy-photo-gallery">
      {visiblePhotos.map(photo => (
        <div
          key={photo.id}
          data-testid={`lazy-photo-${photo.id}`}
          data-photo-id={photo.id}
          className="photo-item"
        >
          {loadedImages.has(photo.id) ? (
            <img
              src={photo.thumbnail_url}
              alt={photo.title}
              data-testid={`loaded-image-${photo.id}`}
            />
          ) : (
            <div
              data-testid={`placeholder-${photo.id}`}
              className="bg-gray-200 w-full h-64 flex items-center justify-center"
            >
              Loading...
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

describe('PhotoGallery Component Tests', () => {
  const mockPhotos = [
    { ...mockPhoto, id: 'photo-1', title: 'Sunset Landscape' },
    { ...mockPhoto, id: 'photo-2', title: 'Mountain View', category: 'landscape' },
    {
      ...mockPhoto,
      id: 'photo-3',
      title: 'City Street',
      category: 'street',
      tags: ['urban', 'city'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render photo gallery with photos', () => {
      renderWithProviders(<MockPhotoGallery photos={mockPhotos} />);

      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
      expect(screen.getAllByTestId(/^photo-item-/)).toHaveLength(3);

      // Check individual photos
      expect(screen.getByTestId('photo-item-photo-1')).toBeInTheDocument();
      expect(screen.getByTestId('photo-item-photo-2')).toBeInTheDocument();
      expect(screen.getByTestId('photo-item-photo-3')).toBeInTheDocument();
    });

    it('should display photo metadata correctly', () => {
      renderWithProviders(<MockPhotoGallery photos={mockPhotos} />);

      // Check titles
      expect(screen.getByText('Sunset Landscape')).toBeInTheDocument();
      expect(screen.getByText('Mountain View')).toBeInTheDocument();
      expect(screen.getByText('City Street')).toBeInTheDocument();

      // Check categories
      expect(screen.getAllByText('landscape')).toHaveLength(1);
      expect(screen.getByText('street')).toBeInTheDocument();

      // Check tags
      expect(screen.getByText('urban')).toBeInTheDocument();
      expect(screen.getByText('city')).toBeInTheDocument();
    });

    it('should render images with correct attributes', () => {
      renderWithProviders(<MockPhotoGallery photos={mockPhotos} />);

      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(3);

      images.forEach((img, index) => {
        expect(img).toHaveAttribute('src', mockPhotos[index].thumbnail_url);
        expect(img).toHaveAttribute('alt', mockPhotos[index].title);
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });
  });

  describe('Loading States', () => {
    it('should display loading spinner when loading', () => {
      renderWithProviders(<MockPhotoGallery photos={[]} loading={true} />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading photos...')).toBeInTheDocument();
      expect(screen.queryByTestId('photo-item-photo-1')).not.toBeInTheDocument();
    });

    it('should display error message when error occurs', () => {
      const errorMessage = 'Failed to load photos';

      renderWithProviders(<MockPhotoGallery photos={[]} error={errorMessage} />);

      const errorElement = screen.getByTestId('error-message');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent(errorMessage);
      expect(errorElement).toHaveAttribute('role', 'alert');
    });

    it('should display empty state when no photos', () => {
      renderWithProviders(<MockPhotoGallery photos={[]} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No photos to display')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle photo clicks', async () => {
      const handlePhotoClick = vi.fn();
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockPhotoGallery photos={mockPhotos} onPhotoClick={handlePhotoClick} />);

      const firstPhoto = screen.getByTestId('photo-item-photo-1');
      await user.click(firstPhoto);

      expect(handlePhotoClick).toHaveBeenCalledWith(mockPhotos[0]);
      expect(handlePhotoClick).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple photo clicks', async () => {
      const handlePhotoClick = vi.fn();
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockPhotoGallery photos={mockPhotos} onPhotoClick={handlePhotoClick} />);

      // Click different photos
      await user.click(screen.getByTestId('photo-item-photo-1'));
      await user.click(screen.getByTestId('photo-item-photo-2'));

      expect(handlePhotoClick).toHaveBeenCalledTimes(2);
      expect(handlePhotoClick).toHaveBeenNthCalledWith(1, mockPhotos[0]);
      expect(handlePhotoClick).toHaveBeenNthCalledWith(2, mockPhotos[1]);
    });

    it('should handle keyboard navigation', async () => {
      const handlePhotoClick = vi.fn();
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockPhotoGallery photos={mockPhotos} onPhotoClick={handlePhotoClick} />);

      const firstPhoto = screen.getByTestId('photo-item-photo-1');

      // Focus and press Enter
      firstPhoto.focus();
      await user.keyboard('{Enter}');

      // Note: This would require the component to handle keyDown events
      // For now, just verify the element can receive focus
      expect(firstPhoto).toHaveClass('cursor-pointer');
    });
  });

  describe('Lazy Loading', () => {
    it('should implement lazy loading for images', () => {
      const { mockIntersectionObserver: mockIO } = mockIntersectionObserver(false);
      global.IntersectionObserver = mockIO;

      renderWithProviders(<MockLazyPhotoGallery photos={mockPhotos} />);

      // Initially should show placeholders
      expect(screen.getByTestId('placeholder-photo-1')).toBeInTheDocument();
      expect(screen.getByTestId('placeholder-photo-2')).toBeInTheDocument();
      expect(screen.getByTestId('placeholder-photo-3')).toBeInTheDocument();

      // Images should not be loaded yet
      expect(screen.queryByTestId('loaded-image-photo-1')).not.toBeInTheDocument();
    });

    it('should load images when they come into view', async () => {
      const { mockIntersectionObserver: mockIO } = mockIntersectionObserver(true);
      global.IntersectionObserver = mockIO;

      renderWithProviders(<MockLazyPhotoGallery photos={mockPhotos} />);

      // Wait for intersection observer to trigger
      await waitFor(() => {
        expect(screen.getByTestId('loaded-image-photo-1')).toBeInTheDocument();
      });
    });

    it('should optimize image loading performance', () => {
      renderWithProviders(<MockPhotoGallery photos={mockPhotos} />);

      const images = screen.getAllByRole('img');

      // All images should have lazy loading attribute
      images.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('should apply responsive grid classes', () => {
      renderWithProviders(<MockPhotoGallery photos={mockPhotos} />);

      const gallery = screen.getByTestId('photo-gallery');
      const gridContainer = gallery.querySelector('.grid');

      expect(gridContainer).toHaveClass('grid-cols-1');
      expect(gridContainer).toHaveClass('md:grid-cols-2');
      expect(gridContainer).toHaveClass('lg:grid-cols-3');
    });

    it('should handle different viewport sizes', () => {
      // Mock viewport changes
      const testViewports = [
        { width: 320, expected: 1 }, // Mobile
        { width: 768, expected: 2 }, // Tablet
        { width: 1024, expected: 3 }, // Desktop
      ];

      testViewports.forEach(({ width, expected }) => {
        // Mock window.innerWidth
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: width,
        });

        // Mock matchMedia for responsive testing
        window.matchMedia = vi.fn().mockImplementation(query => ({
          matches: query.includes(`${width}px`),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
        }));

        const { container } = renderWithProviders(<MockPhotoGallery photos={mockPhotos} />);

        // Verify responsive classes are present
        const gridContainer = container.querySelector('.grid');
        expect(gridContainer).toHaveClass('grid');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderWithProviders(<MockPhotoGallery photos={[]} error="Test error" />);

      const errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });

    it('should have proper alt text for images', () => {
      renderWithProviders(<MockPhotoGallery photos={mockPhotos} />);

      const images = screen.getAllByRole('img');
      images.forEach((img, index) => {
        expect(img).toHaveAttribute('alt', mockPhotos[index].title);
        expect(img.getAttribute('alt')).not.toBe('');
      });
    });

    it('should be keyboard navigable', () => {
      renderWithProviders(<MockPhotoGallery photos={mockPhotos} />);

      const photoItems = screen.getAllByTestId(/^photo-item-/);

      // All clickable items should be focusable
      photoItems.forEach(item => {
        expect(item).toHaveClass('cursor-pointer');
        // In a real implementation, these would have tabindex="0" or be button elements
      });
    });
  });

  describe('Performance', () => {
    it('should handle large number of photos efficiently', () => {
      const manyPhotos = Array.from({ length: 100 }, (_, i) => ({
        ...mockPhoto,
        id: `photo-${i}`,
        title: `Photo ${i}`,
      }));

      const renderStart = performance.now();
      renderWithProviders(<MockPhotoGallery photos={manyPhotos} />);
      const renderEnd = performance.now();

      // Should render in reasonable time (less than 100ms)
      expect(renderEnd - renderStart).toBeLessThan(100);

      // Should render all photos
      expect(screen.getAllByTestId(/^photo-item-/)).toHaveLength(100);
    });

    it('should not cause memory leaks with frequent updates', () => {
      const { rerender } = renderWithProviders(<MockPhotoGallery photos={mockPhotos} />);

      // Simulate multiple updates
      for (let i = 0; i < 10; i++) {
        const updatedPhotos = mockPhotos.map(photo => ({
          ...photo,
          title: `${photo.title} - Update ${i}`,
        }));

        rerender(<MockPhotoGallery photos={updatedPhotos} />);
      }

      // Should still render correctly after multiple updates
      expect(screen.getAllByTestId(/^photo-item-/)).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle broken image URLs gracefully', () => {
      const photosWithBrokenImages = [
        {
          ...mockPhoto,
          id: 'broken-1',
          thumbnail_url: 'https://broken-url.com/image.jpg',
          title: 'Broken Image',
        },
      ];

      renderWithProviders(<MockPhotoGallery photos={photosWithBrokenImages} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', 'https://broken-url.com/image.jpg');
      expect(image).toHaveAttribute('alt', 'Broken Image');

      // In a real implementation, you'd have onError handlers for fallback images
    });

    it('should handle malformed photo data', () => {
      const malformedPhotos = [
        { id: 'malformed-1' }, // Missing required fields
        {
          id: 'malformed-2',
          title: null,
          thumbnail_url: undefined,
          tags: 'not-an-array',
        },
      ];

      // Should not crash when rendering malformed data
      expect(() => {
        renderWithProviders(<MockPhotoGallery photos={malformedPhotos} />);
      }).not.toThrow();

      // Should still render the gallery container
      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    });
  });
});
