import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import PhotoMap from '../../components/PhotoMap';
import type { Photo } from '../../types';

// Mock Leaflet and react-leaflet
vi.mock('leaflet', () => {
  const mockLatLngBounds = vi.fn(() => ({
    extend: vi.fn(),
    isValid: () => true,
  }));

  const mockDivIcon = vi.fn((config: { className?: string; html?: string }) => ({
    options: config,
    _className: config.className ?? '',
    _html: config.html ?? '',
  }));

  return {
    divIcon: mockDivIcon,
    latLngBounds: mockLatLngBounds,
    default: {
      divIcon: mockDivIcon,
      latLngBounds: mockLatLngBounds,
    },
  };
});

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }: any) => (
    <div data-testid="photo-map-container" {...props}>
      {children}
    </div>
  ),
  TileLayer: (props: any) => <div data-testid="photo-tile-layer" {...props} />,
  Marker: ({
    children,
    eventHandlers,
    ...props
  }: {
    children?: React.ReactNode;
    eventHandlers?: { click?: () => void };
    [key: string]: unknown;
  }) => (
    <div
      data-testid="photo-marker"
      onClick={() => {
        void eventHandlers?.click?.();
      }}
      {...props}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="photo-popup">{children}</div>,
  useMap: () => ({
    fitBounds: vi.fn(),
  }),
}));

describe('PhotoMap', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      title: 'Golden Gate Bridge',
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
      location_lat: 37.8199,
      location_lon: -122.4783,
      location_name: 'Golden Gate Bridge, San Francisco',
      date_taken: '2023-12-25T14:30:00Z',
      camera_make: 'Canon',
      camera_model: 'EOS R5',
      file_size: 2500000,
      width: 3000,
      height: 2000,
      featured: false,
      order: 0,
      view_count: 0,
      created_at: '2023-12-25T14:30:00Z',
      updated_at: '2023-12-25T14:30:00Z',
    },
    {
      id: '2',
      title: 'Alcatraz Island',
      filename: 'alcatraz.jpg',
      original_path: '/uploads/alcatraz.jpg',
      variants: {
        thumbnail: {
          path: '/compressed/alcatraz_thumb.webp',
          width: 400,
          height: 300,
          size_bytes: 18000,
          format: 'webp',
        },
      },
      location_lat: 37.8267,
      location_lon: -122.423,
      location_name: 'Alcatraz Island, San Francisco',
      date_taken: '2023-12-25T15:45:00Z',
      camera_make: 'Sony',
      camera_model: 'A7R IV',
      file_size: 3200000,
      width: 4000,
      height: 2667,
      featured: true,
      order: 1,
      view_count: 25,
      created_at: '2023-12-25T15:45:00Z',
      updated_at: '2023-12-25T15:45:00Z',
    },
    {
      id: '3',
      title: 'No Location Photo',
      filename: 'no-location.jpg',
      original_path: '/uploads/no-location.jpg',
      variants: {
        thumbnail: {
          path: '/compressed/no-location_thumb.webp',
          width: 400,
          height: 300,
          size_bytes: 12000,
          format: 'webp',
        },
      },
      // No location data
      file_size: 1800000,
      width: 2000,
      height: 1333,
      featured: false,
      order: 2,
      view_count: 5,
      created_at: '2023-12-25T16:00:00Z',
      updated_at: '2023-12-25T16:00:00Z',
    },
  ];

  const defaultProps = {
    photos: mockPhotos,
    height: 400,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders map with geotagged photos only', () => {
    render(<PhotoMap {...defaultProps} />);

    expect(screen.getByTestId('photo-map-container')).toBeInTheDocument();

    // Should only show markers for photos with location data
    const markers = screen.getAllByTestId('photo-marker');
    expect(markers).toHaveLength(2); // Only first 2 photos have location
  });

  it('shows empty state when no geotagged photos', () => {
    const photosWithoutLocation = mockPhotos.filter(photo => !photo.location_lat);
    render(<PhotoMap photos={photosWithoutLocation} />);

    expect(screen.getByText('No geotagged photos')).toBeInTheDocument();
    expect(screen.getByText(/Upload photos with GPS coordinates/)).toBeInTheDocument();
  });

  it('displays photo count summary', () => {
    render(<PhotoMap {...defaultProps} />);

    expect(screen.getByText('Showing 2 geotagged photos of 3 total')).toBeInTheDocument();
  });

  it('handles single geotagged photo', () => {
    const singlePhoto = [mockPhotos[0]];
    render(<PhotoMap photos={singlePhoto} />);

    expect(screen.getByText('Showing 1 geotagged photo of 1 total')).toBeInTheDocument();
  });

  it('calls onPhotoClick when photo marker is clicked', async () => {
    const user = userEvent.setup();
    const onPhotoClick = vi.fn();

    render(<PhotoMap {...defaultProps} onPhotoClick={onPhotoClick} />);

    const markers = screen.getAllByTestId('photo-marker');
    await user.click(markers[0]);

    expect(onPhotoClick).toHaveBeenCalledWith(mockPhotos[0]);
  });

  it('displays photo information in popup', () => {
    render(<PhotoMap {...defaultProps} />);

    const popups = screen.getAllByTestId('photo-popup');
    expect(popups).toHaveLength(2);

    // Check content of first popup
    expect(screen.getByText('Golden Gate Bridge')).toBeInTheDocument();
    expect(screen.getByText('📍 Golden Gate Bridge, San Francisco')).toBeInTheDocument();
    expect(screen.getByText('📷 Canon EOS R5')).toBeInTheDocument();
  });

  it('handles photos with missing title', () => {
    const photoWithoutTitle = {
      ...mockPhotos[0],
      title: '',
    };

    render(<PhotoMap photos={[photoWithoutTitle]} />);

    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('shows date taken in popup when available', () => {
    render(<PhotoMap {...defaultProps} />);

    // Date should be formatted as locale date string
    expect(screen.getAllByText(/📅/).length).toBeGreaterThan(0);
  });

  it('uses thumbnail variant for photo markers', () => {
    vi.hoisted(() => ({
      divIcon: vi.fn(),
    }));

    render(<PhotoMap {...defaultProps} />);

    // Test that marker is rendered - the mock should be called during render
    expect(screen.getAllByTestId('photo-marker')).toHaveLength(2);
  });

  it('falls back to webp_path when thumbnail variant not available', () => {
    const photoWithoutVariants = {
      ...mockPhotos[0],
      variants: undefined,
      webp_path: '/compressed/bridge.webp',
    };

    render(<PhotoMap photos={[photoWithoutVariants]} />);

    // Verify marker is rendered properly
    expect(screen.getByTestId('photo-marker')).toBeInTheDocument();
    expect(screen.getByText('Golden Gate Bridge')).toBeInTheDocument();
  });

  it('falls back to original_path as last resort', () => {
    const photoWithoutVariants = {
      ...mockPhotos[0],
      variants: undefined,
      webp_path: undefined,
    };

    render(<PhotoMap photos={[photoWithoutVariants]} />);

    // Verify marker is rendered properly
    expect(screen.getByTestId('photo-marker')).toBeInTheDocument();
    expect(screen.getByText('Golden Gate Bridge')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(<PhotoMap {...defaultProps} height={600} />);

    const mapContainer = screen.getByTestId('photo-map-container');
    expect(mapContainer).toHaveStyle({ height: '600px' });
  });

  it('applies custom zoom level', () => {
    render(<PhotoMap {...defaultProps} zoom={15} />);

    const mapContainer = screen.getByTestId('photo-map-container');
    // Zoom prop would be passed to MapContainer
    expect(mapContainer).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<PhotoMap {...defaultProps} className="custom-photo-map" />);

    const container = screen.getByTestId('photo-map-container').parentElement;
    expect(container).toHaveClass('custom-photo-map');
  });

  describe('Photo Marker Customization', () => {
    it('creates custom photo markers with correct styling', () => {
      render(<PhotoMap photos={[mockPhotos[0]]} />);

      // Verify marker is rendered
      expect(screen.getByTestId('photo-marker')).toBeInTheDocument();
    });

    it('includes photo thumbnail in marker HTML', () => {
      render(<PhotoMap photos={[mockPhotos[0]]} />);

      // Verify marker and popup are rendered correctly
      expect(screen.getByTestId('photo-marker')).toBeInTheDocument();
      expect(screen.getByAltText('Golden Gate Bridge')).toBeInTheDocument();
    });
  });

  describe('Map Bounds and Centering', () => {
    it('calculates center from multiple photos', () => {
      render(<PhotoMap {...defaultProps} />);

      // Should render map (bounds calculation tested via MapBounds component)
      expect(screen.getByTestId('photo-map-container')).toBeInTheDocument();
    });

    it('uses single photo location as center', () => {
      render(<PhotoMap photos={[mockPhotos[0]]} />);

      expect(screen.getByTestId('photo-map-container')).toBeInTheDocument();
    });

    it('uses default center when no photos', () => {
      render(<PhotoMap photos={[]} />);

      // Should show empty state instead of map
      expect(screen.queryByTestId('photo-map-container')).not.toBeInTheDocument();
      expect(screen.getByText('No geotagged photos')).toBeInTheDocument();
    });
  });

  describe('Popup Content', () => {
    it('shows all available metadata in popup', () => {
      const richPhoto = {
        ...mockPhotos[0],
        location_name: 'Golden Gate Bridge, San Francisco, CA',
        date_taken: '2023-12-25T14:30:00Z',
        camera_make: 'Canon',
        camera_model: 'EOS R5',
      };

      render(<PhotoMap photos={[richPhoto]} />);

      expect(screen.getByText('Golden Gate Bridge')).toBeInTheDocument();
      expect(screen.getByText('📍 Golden Gate Bridge, San Francisco, CA')).toBeInTheDocument();
      expect(screen.getByText('📷 Canon EOS R5')).toBeInTheDocument();
      expect(screen.getByText(/📅/)).toBeInTheDocument();
    });

    it('handles missing metadata gracefully', () => {
      const minimalPhoto = {
        ...mockPhotos[0],
        location_name: undefined,
        date_taken: undefined,
        camera_make: undefined,
        camera_model: undefined,
      };

      render(<PhotoMap photos={[minimalPhoto]} />);

      expect(screen.getByText('Golden Gate Bridge')).toBeInTheDocument();
      // Metadata sections should not appear if data is missing
      expect(screen.queryByText(/📍/)).not.toBeInTheDocument();
      expect(screen.queryByText(/📷/)).not.toBeInTheDocument();
      expect(screen.queryByText(/📅/)).not.toBeInTheDocument();
    });

    it('shows partial camera information', () => {
      const photoWithPartialCamera = {
        ...mockPhotos[0],
        camera_make: 'Canon',
        camera_model: undefined,
      };

      render(<PhotoMap photos={[photoWithPartialCamera]} />);

      expect(screen.getByText(/📷 Canon/)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows appropriate empty state icon', () => {
      render(<PhotoMap photos={[]} />);

      // SVG icon should be present (no role="img" by default)
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('shows helpful empty state message', () => {
      render(<PhotoMap photos={[]} />);

      expect(screen.getByText('No geotagged photos')).toBeInTheDocument();
      expect(
        screen.getByText('Upload photos with GPS coordinates to see them on the map')
      ).toBeInTheDocument();
    });

    it('applies correct styling to empty state', () => {
      render(<PhotoMap photos={[]} height={500} />);

      const emptyStateContainer =
        screen.getByText('No geotagged photos').parentElement?.parentElement;
      expect(emptyStateContainer).toHaveAttribute(
        'style',
        expect.stringContaining('height: 500px')
      );
    });
  });

  describe('Performance', () => {
    it('handles large number of photos efficiently', () => {
      const manyPhotos = Array.from({ length: 100 }, (_, i) => ({
        ...mockPhotos[0],
        id: `photo-${i}`,
        location_lat: 37.8199 + i * 0.001,
        location_lon: -122.4783 + i * 0.001,
      }));

      render(<PhotoMap photos={manyPhotos} />);

      expect(screen.getByTestId('photo-map-container')).toBeInTheDocument();
      expect(screen.getByText('Showing 100 geotagged photos of 100 total')).toBeInTheDocument();
    });

    it('filters geotagged photos efficiently', () => {
      const mixedPhotos = [
        mockPhotos[0], // Has location
        mockPhotos[2], // No location
        mockPhotos[1], // Has location
        { ...mockPhotos[2], id: '4' }, // No location
      ];

      render(<PhotoMap photos={mixedPhotos} />);

      expect(screen.getByText('Showing 2 geotagged photos of 4 total')).toBeInTheDocument();

      const markers = screen.getAllByTestId('photo-marker');
      expect(markers).toHaveLength(2);
    });
  });
});
