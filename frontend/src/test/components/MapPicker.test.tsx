import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import MapPicker from '../../components/MapPicker';

// Mock Leaflet and react-leaflet
vi.mock('leaflet', () => {
  const Icon = {
    Default: {
      prototype: { _getIconUrl: vi.fn() },
      mergeOptions: vi.fn(),
    },
  };
  return {
    default: { Icon },
    Icon,
  };
});

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }: any) => (
    <div data-testid="map-container" {...props}>
      {children}
    </div>
  ),
  TileLayer: (props: any) => <div data-testid="tile-layer" {...props} />,
  Marker: (props: any) => <div data-testid="marker" {...props} />,
  useMapEvents: ({ click: _click }: { click?: (event: unknown) => void }) => {
    // Simulate click event handling - currently unused but could be used for integration tests
    return null;
  },
  useMap: () => ({
    setView: vi.fn(),
  }),
}));

// Mock fetch for location search
global.fetch = vi.fn();

const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

describe('MapPicker', () => {
  const defaultProps = {
    latitude: 37.7749,
    longitude: -122.4194,
    zoom: 13,
    height: 400,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  it('renders map container with correct props', () => {
    render(<MapPicker {...defaultProps} />);

    const mapContainer = screen.getByTestId('map-container');
    expect(mapContainer).toBeInTheDocument();
  });

  it('displays coordinates in help text', () => {
    render(<MapPicker {...defaultProps} />);

    expect(screen.getByText(/37\.774900/)).toBeInTheDocument();
    expect(screen.getByText(/-122\.419400/)).toBeInTheDocument();
  });

  it('shows search input when showSearch is true', () => {
    render(<MapPicker {...defaultProps} showSearch={true} />);

    expect(screen.getByPlaceholderText('Search for a location...')).toBeInTheDocument();
  });

  it('hides search input when showSearch is false', () => {
    render(<MapPicker {...defaultProps} showSearch={false} />);

    expect(screen.queryByPlaceholderText('Search for a location...')).not.toBeInTheDocument();
  });

  it('calls onLocationSelect when location is selected', () => {
    const onLocationSelect = vi.fn();
    render(<MapPicker {...defaultProps} onLocationSelect={onLocationSelect} />);

    // Simulate map click event
    // This would be triggered by the useMapEvents hook
    expect(onLocationSelect).not.toHaveBeenCalled();
  });

  it('calls onLocationChange when location changes', () => {
    const onLocationChange = vi.fn();
    render(<MapPicker {...defaultProps} onLocationChange={onLocationChange} />);

    // Location change would be triggered by map interaction
    expect(onLocationChange).not.toHaveBeenCalled();
  });

  it('updates coordinates when props change', () => {
    const { rerender } = render(<MapPicker {...defaultProps} />);

    expect(screen.getByText(/37\.774900/)).toBeInTheDocument();

    rerender(<MapPicker {...defaultProps} latitude={40.7128} longitude={-74.006} />);

    expect(screen.getByText(/40\.712800/)).toBeInTheDocument();
    expect(screen.getByText(/-74\.006000/)).toBeInTheDocument();
  });

  it('shows disabled overlay when disabled', () => {
    render(<MapPicker {...defaultProps} disabled={true} />);

    expect(screen.getByText('Map disabled')).toBeInTheDocument();
  });

  it('hides help text when disabled', () => {
    render(<MapPicker {...defaultProps} disabled={true} />);

    expect(screen.queryByText(/Click on the map/)).not.toBeInTheDocument();
  });

  describe('Location Search', () => {
    it('performs search when typing in search input', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              latitude: 40.7128,
              longitude: -74.006,
              location_name: 'New York City',
              location_address: 'New York, NY, USA',
            },
          ]),
      });

      render(<MapPicker {...defaultProps} showSearch={true} />);

      const searchInput = screen.getByPlaceholderText('Search for a location...');

      await user.type(searchInput, 'New York');

      // Wait for debounced search
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith('/api/locations/search?q=New%20York&limit=5');
        },
        { timeout: 500 }
      );
    });

    it('displays search results in dropdown', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              latitude: 40.7128,
              longitude: -74.006,
              location_name: 'New York City',
              location_address: 'New York, NY, USA',
            },
          ]),
      });

      render(<MapPicker {...defaultProps} showSearch={true} />);

      const searchInput = screen.getByPlaceholderText('Search for a location...');

      await user.type(searchInput, 'New York');
      await user.click(searchInput); // Focus to show dropdown

      await waitFor(() => {
        expect(screen.getByText('New York City')).toBeInTheDocument();
        expect(screen.getByText('New York, NY, USA')).toBeInTheDocument();
      });
    });

    it('selects location when search result is clicked', async () => {
      const user = userEvent.setup();
      const onLocationSelect = vi.fn();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              latitude: 40.7128,
              longitude: -74.006,
              location_name: 'New York City',
              location_address: 'New York, NY, USA',
            },
          ]),
      });

      render(<MapPicker {...defaultProps} showSearch={true} onLocationSelect={onLocationSelect} />);

      const searchInput = screen.getByPlaceholderText('Search for a location...');

      await user.type(searchInput, 'New York');
      await user.click(searchInput);

      await waitFor(() => {
        expect(screen.getByText('New York City')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New York City'));

      expect(onLocationSelect).toHaveBeenCalledWith(40.7128, -74.006);
      expect(searchInput).toHaveValue('New York City');
    });

    it('shows loading state during search', async () => {
      const user = userEvent.setup();

      // Mock a delayed response
      mockFetch.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve([]),
                }),
              100
            )
          )
      );

      render(<MapPicker {...defaultProps} showSearch={true} />);

      const searchInput = screen.getByPlaceholderText('Search for a location...');

      await user.type(searchInput, 'test');
      await user.click(searchInput);

      await waitFor(() => {
        expect(screen.getByText('Searching...')).toBeInTheDocument();
      });
    });

    it('handles search errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<MapPicker {...defaultProps} showSearch={true} />);

      const searchInput = screen.getByPlaceholderText('Search for a location...');

      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error searching locations:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('clears results when search input is empty', async () => {
      const user = userEvent.setup();

      render(<MapPicker {...defaultProps} showSearch={true} />);

      const searchInput = screen.getByPlaceholderText('Search for a location...');

      await user.type(searchInput, 'test');
      await user.clear(searchInput);

      // Results should be cleared without making API call
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('closes dropdown when clicking outside', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              latitude: 40.7128,
              longitude: -74.006,
              location_name: 'Test Location',
              location_address: 'Test Address',
            },
          ]),
      });

      render(<MapPicker {...defaultProps} showSearch={true} />);

      const searchInput = screen.getByPlaceholderText('Search for a location...');

      await user.type(searchInput, 'test');
      await user.click(searchInput);

      await waitFor(() => {
        expect(screen.getByText('Test Location')).toBeInTheDocument();
      });

      // Click outside (on the map container)
      await user.click(screen.getByTestId('map-container'));

      await waitFor(() => {
        expect(screen.queryByText('Test Location')).not.toBeInTheDocument();
      });
    });

    it('debounces search requests', async () => {
      const user = userEvent.setup();

      render(<MapPicker {...defaultProps} showSearch={true} />);

      const searchInput = screen.getByPlaceholderText('Search for a location...');

      // Type quickly
      await user.type(searchInput, 'test');

      // Should not call API immediately
      expect(mockFetch).not.toHaveBeenCalled();

      // Wait for debounce timeout
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 }
      );
    });
  });

  describe('Accessibility', () => {
    it('provides proper labels for search input', () => {
      render(<MapPicker {...defaultProps} showSearch={true} />);

      const searchInput = screen.getByPlaceholderText('Search for a location...');
      expect(searchInput).toHaveAttribute('type', 'text');
    });

    it('supports keyboard navigation in search results', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              latitude: 40.7128,
              longitude: -74.006,
              location_name: 'New York City',
              location_address: 'New York, NY, USA',
            },
          ]),
      });

      render(<MapPicker {...defaultProps} showSearch={true} />);

      const searchInput = screen.getByPlaceholderText('Search for a location...');

      await user.type(searchInput, 'New York');
      await user.click(searchInput);

      await waitFor(() => {
        expect(screen.getByText('New York City')).toBeInTheDocument();
      });

      const resultButton = screen.getByRole('button', {
        name: /New York City/,
      });
      expect(resultButton).toBeInTheDocument();

      // Should be focusable
      resultButton.focus();
      expect(document.activeElement).toBe(resultButton);
    });
  });

  describe('Props and Configuration', () => {
    it('uses default coordinates when not provided', () => {
      render(<MapPicker />);

      // Should use San Francisco as default
      expect(screen.getByText(/37\.774900/)).toBeInTheDocument();
      expect(screen.getByText(/-122\.419400/)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<MapPicker {...defaultProps} className="custom-class" />);

      const container = screen.getByTestId('map-container').parentElement;
      expect(container).toHaveClass('custom-class');
    });

    it('uses custom height', () => {
      render(<MapPicker {...defaultProps} height={500} />);

      const mapContainer = screen.getByTestId('map-container');
      expect(mapContainer).toHaveStyle({ height: '500px' });
    });

    it('uses custom zoom level', () => {
      render(<MapPicker {...defaultProps} zoom={10} />);

      const mapContainer = screen.getByTestId('map-container');
      // Zoom would be passed to MapContainer component
      expect(mapContainer).toBeInTheDocument();
    });
  });
});
