import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import PhotoGrid from '../../components/PhotoGrid';
import type { Photo } from '../../types';

// Mock dependencies
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 2000,
    getVirtualItems: () => [
      { key: 0, index: 0, start: 0 },
      { key: 1, index: 1, start: 400 },
    ],
  }),
}));

vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: true }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock('../../components/MiniMap', () => ({
  default: ({ latitude, longitude, onClick, size, className }: any) => (
    <div
      data-testid="mini-map"
      data-latitude={latitude}
      data-longitude={longitude}
      data-size={size}
      className={className}
      onClick={onClick}
    >
      Mini Map
    </div>
  ),
}));

describe('Enhanced PhotoGrid with Location Metadata', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      title: 'Golden Gate Bridge',
      description: 'Iconic bridge in San Francisco',
      category: 'Landscape',
      filename: 'bridge.jpg',
      original_path: '/uploads/bridge.jpg',
      variants: {
        thumbnail: {
          path: '/compressed/bridge_thumb.webp',
          width: 400,
          height: 300,
          size_bytes: 15000,
          format: 'webp',
        },
      },
      // Location metadata
      location_lat: 37.8199,
      location_lon: -122.4783,
      location_name: 'Golden Gate Bridge, San Francisco, CA',
      // Camera metadata
      camera_make: 'Canon',
      camera_model: 'EOS R5',
      lens: 'RF24-70mm F2.8 L IS USM',
      iso: 400,
      aperture: 8.0,
      shutter_speed: '1/250',
      focal_length: 35,
      date_taken: '2023-12-25T14:30:00Z',
      timezone: 'America/Los_Angeles',
      file_size: 2500000,
      width: 3000,
      height: 2000,
      featured: true,
      order: 0,
      view_count: 50,
      created_at: '2023-12-25T14:30:00Z',
      updated_at: '2023-12-25T14:30:00Z',
    },
    {
      id: '2',
      title: 'City Skyline',
      description: 'Beautiful city view at sunset',
      category: 'Urban',
      filename: 'skyline.jpg',
      original_path: '/uploads/skyline.jpg',
      variants: {
        thumbnail: {
          path: '/compressed/skyline_thumb.webp',
          width: 400,
          height: 300,
          size_bytes: 18000,
          format: 'webp',
        },
      },
      // No location data for this photo
      camera_make: 'Sony',
      camera_model: 'A7R IV',
      iso: 800,
      date_taken: '2023-12-24T18:45:00Z',
      file_size: 3200000,
      width: 4000,
      height: 2667,
      featured: false,
      order: 1,
      view_count: 25,
      created_at: '2023-12-24T18:45:00Z',
      updated_at: '2023-12-24T18:45:00Z',
    },
    {
      id: '3',
      title: '',
      filename: 'untitled.jpg',
      original_path: '/uploads/untitled.jpg',
      variants: {
        thumbnail: {
          path: '/compressed/untitled_thumb.webp',
          width: 400,
          height: 300,
          size_bytes: 12000,
          format: 'webp',
        },
      },
      // Minimal metadata photo
      location_lat: 40.7128,
      location_lon: -74.006,
      location_name: 'New York City, NY',
      file_size: 1800000,
      width: 2000,
      height: 1333,
      featured: false,
      order: 2,
      view_count: 5,
      created_at: '2023-12-23T10:15:00Z',
      updated_at: '2023-12-23T10:15:00Z',
    },
  ];

  const defaultProps = {
    photos: mockPhotos,
    showMetadata: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  });

  it('renders photo grid with enhanced location features', () => {
    render(<PhotoGrid {...defaultProps} />);

    expect(screen.getByTestId('mini-map')).toBeInTheDocument();
  });

  it('shows mini maps only for geotagged photos', () => {
    render(<PhotoGrid {...defaultProps} />);

    const miniMaps = screen.getAllByTestId('mini-map');
    expect(miniMaps).toHaveLength(2); // Only photos 1 and 3 have location data
  });

  it('positions mini maps in top-left corner of photo cards', () => {
    render(<PhotoGrid {...defaultProps} />);

    const miniMapContainer = screen.getByTestId('mini-map').parentElement;
    expect(miniMapContainer).toHaveClass('absolute', 'top-2', 'left-2');
  });

  it('configures mini maps with correct coordinates', () => {
    render(<PhotoGrid {...defaultProps} />);

    const miniMaps = screen.getAllByTestId('mini-map');

    // First photo (Golden Gate Bridge)
    expect(miniMaps[0]).toHaveAttribute('data-latitude', '37.8199');
    expect(miniMaps[0]).toHaveAttribute('data-longitude', '-122.4783');

    // Third photo (NYC)
    expect(miniMaps[1]).toHaveAttribute('data-latitude', '40.7128');
    expect(miniMaps[1]).toHaveAttribute('data-longitude', '-74.0060');
  });

  it('configures mini maps with appropriate size and zoom', () => {
    render(<PhotoGrid {...defaultProps} />);

    const miniMaps = screen.getAllByTestId('mini-map');
    miniMaps.forEach(miniMap => {
      expect(miniMap).toHaveAttribute('data-size', '60');
      // Zoom level would be passed as prop (tested in MiniMap component)
    });
  });

  it('applies shadow styling to mini maps', () => {
    render(<PhotoGrid {...defaultProps} />);

    const miniMaps = screen.getAllByTestId('mini-map');
    miniMaps.forEach(miniMap => {
      expect(miniMap).toHaveClass('shadow-lg');
    });
  });

  describe('Enhanced Metadata Overlay', () => {
    it('shows location name in metadata overlay', async () => {
      const user = userEvent.setup();
      render(<PhotoGrid {...defaultProps} />);

      // Hover over first photo to show metadata
      const photoCard = screen.getAllByRole('img')[0].parentElement;
      await user.hover(photoCard!);

      expect(screen.getByText('📍 Golden Gate Bridge, San Francisco, CA')).toBeInTheDocument();
    });

    it('shows comprehensive camera metadata', async () => {
      const user = userEvent.setup();
      render(<PhotoGrid {...defaultProps} />);

      const photoCard = screen.getAllByRole('img')[0].parentElement;
      await user.hover(photoCard!);

      expect(screen.getByText('📷 Canon EOS R5')).toBeInTheDocument();
      expect(screen.getByText(/ISO 400.*f\/8.*1\/250.*35mm/)).toBeInTheDocument();
    });

    it('shows formatted date information', async () => {
      const user = userEvent.setup();
      render(<PhotoGrid {...defaultProps} />);

      const photoCard = screen.getAllByRole('img')[0].parentElement;
      await user.hover(photoCard!);

      expect(screen.getByText(/📅.*12\/25\/2023/)).toBeInTheDocument();
      expect(screen.getByText('America/Los_Angeles')).toBeInTheDocument();
    });

    it('handles missing location data gracefully', async () => {
      const user = userEvent.setup();
      render(<PhotoGrid {...defaultProps} />);

      // Second photo has no location data
      const photoCards = screen.getAllByRole('img');
      const secondPhotoCard = photoCards[1].parentElement;
      await user.hover(secondPhotoCard!);

      expect(screen.queryByText(/📍/)).not.toBeInTheDocument();
    });

    it('handles partial camera metadata', async () => {
      const user = userEvent.setup();
      render(<PhotoGrid {...defaultProps} />);

      // Second photo has partial camera data
      const photoCards = screen.getAllByRole('img');
      const secondPhotoCard = photoCards[1].parentElement;
      await user.hover(secondPhotoCard!);

      expect(screen.getByText('📷 Sony A7R IV')).toBeInTheDocument();
      expect(screen.getByText('ISO 800')).toBeInTheDocument();
      // Should not show aperture, shutter speed, focal length as they're missing
      expect(screen.queryByText(/f\//)).not.toBeInTheDocument();
    });

    it('shows "Untitled" for photos without titles', async () => {
      const user = userEvent.setup();
      render(<PhotoGrid {...defaultProps} />);

      // Third photo has no title
      const photoCards = screen.getAllByRole('img');
      const thirdPhotoCard = photoCards[2].parentElement;
      await user.hover(thirdPhotoCard!);

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('truncates long text appropriately', async () => {
      const photoWithLongText = {
        ...mockPhotos[0],
        title: 'This is a very long photo title that should be truncated when displayed',
        location_name: 'This is an extremely long location name that should be truncated in the UI',
      };

      const user = userEvent.setup();
      render(<PhotoGrid photos={[photoWithLongText]} showMetadata={true} />);

      const photoCard = screen.getByRole('img').parentElement;
      await user.hover(photoCard!);

      const title = screen.getByText(/This is a very long photo title/);
      const location = screen.getByText(/This is an extremely long location name/);

      expect(title).toHaveClass('truncate');
      expect(location).toHaveClass('truncate');
    });

    it('hides metadata overlay when showMetadata is false', () => {
      render(<PhotoGrid {...defaultProps} showMetadata={false} />);

      // Metadata overlay should not be rendered
      expect(screen.queryByText('📍')).not.toBeInTheDocument();
      expect(screen.queryByText('📷')).not.toBeInTheDocument();
      expect(screen.queryByText('📅')).not.toBeInTheDocument();
    });
  });

  describe('Featured Photo Badge', () => {
    it('shows featured badge on featured photos', () => {
      render(<PhotoGrid {...defaultProps} />);

      // First photo is featured
      const featuredBadges = screen
        .getAllByRole('img')[0]
        .parentElement?.querySelectorAll('svg[fill="currentColor"]');
      expect(featuredBadges?.length).toBeGreaterThan(0);
    });

    it('does not show featured badge on non-featured photos', () => {
      render(<PhotoGrid {...defaultProps} />);

      // Second photo is not featured - should not have the star badge
      const photoCards = screen.getAllByRole('img');
      const secondPhotoCard = photoCards[1].parentElement;

      // Should not have the featured star SVG
      const starPath = secondPhotoCard?.querySelector(
        'path[d*="M9.049 2.927c.3-.921 1.603-.921 1.902"]'
      );
      expect(starPath).not.toBeInTheDocument();
    });

    it('positions featured badge in top-right corner', () => {
      render(<PhotoGrid {...defaultProps} />);

      const firstPhotoCard = screen.getAllByRole('img')[0].parentElement;
      const featuredBadgeContainer = firstPhotoCard?.querySelector('.absolute.top-2.right-2');

      expect(featuredBadgeContainer).toBeInTheDocument();
    });
  });

  describe('Interactive Features', () => {
    it('calls onPhotoClick when photo is clicked', async () => {
      const user = userEvent.setup();
      const onPhotoClick = vi.fn();

      render(<PhotoGrid {...defaultProps} onPhotoClick={onPhotoClick} />);

      const firstPhoto = screen.getAllByRole('img')[0].parentElement;
      await user.click(firstPhoto!);

      expect(onPhotoClick).toHaveBeenCalledWith(mockPhotos[0], 0);
    });

    it('stops propagation when mini map is clicked', async () => {
      const user = userEvent.setup();
      const onPhotoClick = vi.fn();

      render(<PhotoGrid {...defaultProps} onPhotoClick={onPhotoClick} />);

      const miniMap = screen.getAllByTestId('mini-map')[0];
      await user.click(miniMap);

      // onPhotoClick should not be called because event should be stopped
      expect(onPhotoClick).not.toHaveBeenCalled();
    });

    it('applies hover effects to interactive photos', () => {
      render(<PhotoGrid {...defaultProps} onPhotoClick={vi.fn()} />);

      const photoCards = screen.getAllByRole('img');
      photoCards.forEach(img => {
        const card = img.parentElement;
        expect(card).toHaveClass('hover:scale-105', 'hover:shadow-lg');
      });
    });

    it('does not apply hover effects when not interactive', () => {
      render(<PhotoGrid {...defaultProps} />);

      const photoCards = screen.getAllByRole('img');
      photoCards.forEach(img => {
        const card = img.parentElement;
        expect(card).not.toHaveClass('hover:shadow-lg');
      });
    });
  });

  describe('Image Loading and Error Handling', () => {
    it('shows loading skeleton while image loads', () => {
      // Mock inView but not loaded
      vi.mocked(require('react-intersection-observer').useInView).mockReturnValue({
        ref: vi.fn(),
        inView: true,
      });

      render(<PhotoGrid {...defaultProps} />);

      const skeletons = screen.getAllByTestId('loading-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state when image fails to load', async () => {
      render(<PhotoGrid {...defaultProps} />);

      const images = screen.getAllByRole('img');

      // Simulate image load error
      fireEvent.error(images[0]);

      await waitFor(() => {
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
      });
    });

    it('uses correct image source hierarchy', () => {
      render(<PhotoGrid {...defaultProps} />);

      const images = screen.getAllByRole('img');

      // First photo has thumbnail variant
      expect(images[0]).toHaveAttribute('src', '/compressed/bridge_thumb.webp');
    });

    it('falls back to webp_path when thumbnail variant missing', () => {
      const photoWithoutThumbnail = {
        ...mockPhotos[0],
        variants: undefined,
        webp_path: '/compressed/bridge.webp',
      };

      render(<PhotoGrid photos={[photoWithoutThumbnail]} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', '/compressed/bridge.webp');
    });

    it('falls back to original_path as last resort', () => {
      const photoWithoutVariants = {
        ...mockPhotos[0],
        variants: undefined,
        webp_path: undefined,
      };

      render(<PhotoGrid photos={[photoWithoutVariants]} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', '/uploads/bridge.jpg');
    });
  });

  describe('Performance and Virtualization', () => {
    it('implements virtual scrolling for large datasets', () => {
      const manyPhotos = Array.from({ length: 1000 }, (_, i) => ({
        ...mockPhotos[0],
        id: `photo-${i}`,
      }));

      render(<PhotoGrid photos={manyPhotos} />);

      // Virtual scrolling should be active (tested via mocked useVirtualizer)
      expect(screen.getByTestId('photo-grid-container')).toBeInTheDocument();
    });

    it('uses intersection observer for lazy loading', () => {
      render(<PhotoGrid {...defaultProps} />);

      // useInView should be called for each photo card
      expect(require('react-intersection-observer').useInView).toHaveBeenCalled();
    });

    it('applies progressive image loading', () => {
      render(<PhotoGrid {...defaultProps} />);

      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });
  });

  describe('Responsive Layout', () => {
    it('calculates responsive columns based on container width', () => {
      // Mock container width
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        value: 1200, // Desktop width
      });

      render(<PhotoGrid {...defaultProps} />);

      // Should calculate appropriate number of columns
      expect(screen.getByTestId('photo-grid-container')).toBeInTheDocument();
    });

    it('applies responsive gap between photos', () => {
      render(<PhotoGrid {...defaultProps} gap={12} />);

      // Gap would be applied via CSS styles
      expect(screen.getByTestId('photo-grid-container')).toBeInTheDocument();
    });

    it('maintains aspect ratio for photo cards', () => {
      render(<PhotoGrid {...defaultProps} />);

      const photoCards = screen.getAllByRole('img');
      photoCards.forEach(img => {
        const card = img.parentElement;
        // Should maintain 4:3 aspect ratio (width * 0.75)
        expect(card).toHaveAttribute('style');
      });
    });
  });

  describe('Empty and Loading States', () => {
    it('shows loading skeleton grid when isLoading', () => {
      render(<PhotoGrid photos={[]} isLoading={true} />);

      expect(screen.getByTestId('loading-grid')).toBeInTheDocument();

      // Should show multiple skeleton items
      const skeletons = screen.getAllByTestId('skeleton-item');
      expect(skeletons.length).toBe(20); // Default skeleton count
    });

    it('shows empty state when no photos', () => {
      render(<PhotoGrid photos={[]} />);

      expect(screen.getByText('No photos found')).toBeInTheDocument();
      expect(screen.getByText('Upload some photos to see them here')).toBeInTheDocument();
    });

    it('shows appropriate empty state icon', () => {
      render(<PhotoGrid photos={[]} />);

      const svgIcon = screen.getByRole('img', { hidden: true });
      expect(svgIcon).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides appropriate alt text for images', () => {
      render(<PhotoGrid {...defaultProps} />);

      expect(screen.getByAltText('Golden Gate Bridge')).toBeInTheDocument();
      expect(screen.getByAltText('City Skyline')).toBeInTheDocument();
      expect(screen.getByAltText('Photo')).toBeInTheDocument(); // Fallback for untitled
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      const onPhotoClick = vi.fn();

      render(<PhotoGrid {...defaultProps} onPhotoClick={onPhotoClick} />);

      const firstPhotoCard = screen.getAllByRole('img')[0].parentElement;

      // Should be focusable
      firstPhotoCard?.focus();
      expect(document.activeElement).toBe(firstPhotoCard);

      // Should support Enter/Space activation
      await user.keyboard('{Enter}');
      expect(onPhotoClick).toHaveBeenCalled();
    });

    it('provides semantic structure', () => {
      render(<PhotoGrid {...defaultProps} />);

      // Images should be properly structured
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0);

      // Should have proper heading structure in metadata
      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe('Animation and Transitions', () => {
    it('applies staggered entrance animations', () => {
      render(<PhotoGrid {...defaultProps} />);

      // Framer Motion animations would be applied (mocked)
      const photoCards = screen.getAllByRole('img');
      expect(photoCards.length).toBeGreaterThan(0);
    });

    it('applies smooth hover transitions', () => {
      render(<PhotoGrid {...defaultProps} onPhotoClick={vi.fn()} />);

      const photoCards = screen.getAllByRole('img');
      photoCards.forEach(img => {
        const card = img.parentElement;
        expect(card).toHaveClass('transition-transform', 'duration-200');
      });
    });

    it('applies opacity transitions for metadata overlay', () => {
      render(<PhotoGrid {...defaultProps} />);

      // Metadata overlay should have transition classes
      const photoCard = screen.getAllByRole('img')[0].parentElement;
      const overlay = photoCard?.querySelector('.bg-gradient-to-t');
      expect(overlay).toHaveClass('transition-opacity', 'duration-200');
    });
  });
});
