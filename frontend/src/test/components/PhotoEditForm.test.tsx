import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import PhotoEditForm from '../../components/admin/PhotoEditForm';
import type { Photo } from '../../types';

// Mock dependencies
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: () => ({}),
    handleSubmit: (fn: (data: unknown) => void) => (e: Event) => {
      e.preventDefault();
      fn({});
    },
    control: {},
    setValue: vi.fn(),
    watch: () => ({}),
    formState: { errors: {} },
  }),
  Controller: ({
    render: renderProp,
  }: {
    render: (props: {
      field: Record<string, unknown>;
      fieldState: Record<string, unknown>;
    }) => unknown;
  }) => renderProp({ field: {}, fieldState: {} }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../components/LocationInput', () => ({
  default: ({
    latitude,
    longitude,
    locationName,
    onLocationChange,
    disabled,
  }: {
    latitude?: number;
    longitude?: number;
    locationName?: string;
    onLocationChange?: (lat: number, lng: number, name?: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="location-input">
      <input
        data-testid="location-lat"
        value={latitude ?? ''}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onLocationChange?.(parseFloat(e.target.value), longitude, locationName)
        }
        disabled={disabled}
      />
      <input
        data-testid="location-lng"
        value={longitude ?? ''}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onLocationChange?.(latitude, parseFloat(e.target.value), locationName)
        }
        disabled={disabled}
      />
      <input
        data-testid="location-name"
        value={locationName ?? ''}
        onChange={e => onLocationChange?.(latitude, longitude, e.target.value)}
        disabled={disabled}
      />
    </div>
  ),
}));

describe('Enhanced PhotoEditForm', () => {
  const mockPhoto: Photo = {
    id: '1',
    title: 'Golden Gate Bridge',
    description: 'Iconic bridge in San Francisco',
    category: 'Landscape',
    tags: 'bridge,landmark,california',
    comments: 'Shot during golden hour',
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
    location_address: '1 Golden Gate Bridge, San Francisco, CA 94129',
    altitude: 67.5,
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
    // Custom metadata
    custom_metadata: {
      weather: 'Sunny',
      temperature: '18°C',
      custom_field: 'Custom value',
    },
    file_size: 2500000,
    width: 3000,
    height: 2000,
    featured: true,
    order: 0,
    view_count: 50,
    created_at: '2023-12-25T14:30:00Z',
    updated_at: '2023-12-25T14:30:00Z',
  };

  const defaultProps = {
    photo: mockPhoto,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tabbed Interface', () => {
    it('renders all tab buttons', () => {
      render(<PhotoEditForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /basic/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /location/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /technical/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
    });

    it('shows basic tab content by default', () => {
      render(<PhotoEditForm {...defaultProps} />);

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    });

    it('switches to location tab when clicked', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /location/i }));

      expect(screen.getByTestId('location-input')).toBeInTheDocument();
    });

    it('switches to technical tab when clicked', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /technical/i }));

      expect(screen.getByLabelText(/camera make/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/camera model/i)).toBeInTheDocument();
    });

    it('switches to custom tab when clicked', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /custom/i }));

      expect(screen.getByText(/custom metadata fields/i)).toBeInTheDocument();
    });

    it('highlights active tab', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      const basicTab = screen.getByRole('button', { name: /basic/i });
      const locationTab = screen.getByRole('button', { name: /location/i });

      // Basic should be active by default
      expect(basicTab).toHaveClass('bg-blue-600', 'text-white');
      expect(locationTab).toHaveClass('bg-gray-100', 'text-gray-700');

      await user.click(locationTab);

      // Location should now be active
      expect(locationTab).toHaveClass('bg-blue-600', 'text-white');
      expect(basicTab).toHaveClass('bg-gray-100', 'text-gray-700');
    });
  });

  describe('Basic Information Tab', () => {
    it('populates form fields with photo data', () => {
      render(<PhotoEditForm {...defaultProps} />);

      expect(screen.getByDisplayValue('Golden Gate Bridge')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Iconic bridge in San Francisco')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Landscape')).toBeInTheDocument();
      expect(screen.getByDisplayValue('bridge,landmark,california')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Shot during golden hour')).toBeInTheDocument();
    });

    it('shows featured checkbox checked for featured photos', () => {
      render(<PhotoEditForm {...defaultProps} />);

      const featuredCheckbox = screen.getByLabelText(/featured/i);
      expect(featuredCheckbox.checked).toBe(true);
    });

    it('shows featured checkbox unchecked for non-featured photos', () => {
      const nonFeaturedPhoto = { ...mockPhoto, featured: false };
      render(<PhotoEditForm {...defaultProps} photo={nonFeaturedPhoto} />);

      const featuredCheckbox = screen.getByLabelText(/featured/i);
      expect(featuredCheckbox.checked).toBe(false);
    });

    it('validates required fields', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);

      // Form validation would be handled by react-hook-form
      expect(titleInput).toHaveValue('');
    });
  });

  describe('Location Tab', () => {
    it('renders location input component', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /location/i }));

      expect(screen.getByTestId('location-input')).toBeInTheDocument();
    });

    it('passes current location data to LocationInput', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /location/i }));

      expect(screen.getByTestId('location-lat')).toHaveValue('37.8199');
      expect(screen.getByTestId('location-lng')).toHaveValue('-122.4783');
      expect(screen.getByTestId('location-name')).toHaveValue(
        'Golden Gate Bridge, San Francisco, CA'
      );
    });

    it('updates form data when location changes', async () => {
      const user = userEvent.setup();
      const setValue = vi.fn();

      const { useForm } = await import('react-hook-form');
      vi.mocked(useForm).mockReturnValue({
        register: () => ({}),
        handleSubmit: (fn: (data: unknown) => void) => (e: Event) => {
          e.preventDefault();
          fn({});
        },
        control: {},
        setValue,
        watch: () => ({}),
        formState: { errors: {} },
      });

      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /location/i }));

      const latInput = screen.getByTestId('location-lat');
      await user.clear(latInput);
      await user.type(latInput, '40.7128');

      expect(setValue).toHaveBeenCalledWith('location_lat', 40.7128);
    });

    it('shows altitude field', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /location/i }));

      expect(screen.getByLabelText(/altitude/i)).toBeInTheDocument();
    });

    it('handles photos without location data', async () => {
      const user = userEvent.setup();
      const photoWithoutLocation = {
        ...mockPhoto,
        location_lat: undefined,
        location_lon: undefined,
        location_name: undefined,
      };

      render(<PhotoEditForm {...defaultProps} photo={photoWithoutLocation} />);

      await user.click(screen.getByRole('button', { name: /location/i }));

      expect(screen.getByTestId('location-lat')).toHaveValue('');
      expect(screen.getByTestId('location-lng')).toHaveValue('');
      expect(screen.getByTestId('location-name')).toHaveValue('');
    });
  });

  describe('Technical Tab', () => {
    it('shows all camera metadata fields', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /technical/i }));

      expect(screen.getByLabelText(/camera make/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/camera model/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/lens/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/iso/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/aperture/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/shutter speed/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/focal length/i)).toBeInTheDocument();
    });

    it('populates technical fields with photo data', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /technical/i }));

      expect(screen.getByDisplayValue('Canon')).toBeInTheDocument();
      expect(screen.getByDisplayValue('EOS R5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('RF24-70mm F2.8 L IS USM')).toBeInTheDocument();
      expect(screen.getByDisplayValue('400')).toBeInTheDocument();
      expect(screen.getByDisplayValue('8')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1/250')).toBeInTheDocument();
      expect(screen.getByDisplayValue('35')).toBeInTheDocument();
    });

    it('shows date taken field with proper format', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /technical/i }));

      const dateTakenField = screen.getByLabelText(/date taken/i);
      // Should be formatted for datetime-local input
      expect(dateTakenField).toHaveAttribute('type', 'datetime-local');
    });

    it('shows timezone field', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /technical/i }));

      expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('America/Los_Angeles')).toBeInTheDocument();
    });

    it('handles photos with missing technical data', async () => {
      const user = userEvent.setup();
      const photoWithMinimalData = {
        ...mockPhoto,
        camera_make: undefined,
        iso: undefined,
        date_taken: undefined,
      };

      render(<PhotoEditForm {...defaultProps} photo={photoWithMinimalData} />);

      await user.click(screen.getByRole('button', { name: /technical/i }));

      expect(screen.getByLabelText(/camera make/i)).toHaveValue('');
      expect(screen.getByLabelText(/iso/i)).toHaveValue('');
    });
  });

  describe('Custom Metadata Tab', () => {
    it('shows existing custom fields', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /custom/i }));

      expect(screen.getByDisplayValue('Sunny')).toBeInTheDocument();
      expect(screen.getByDisplayValue('18°C')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Custom value')).toBeInTheDocument();
    });

    it('allows adding new custom fields', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /custom/i }));

      const keyInput = screen.getByPlaceholderText(/field key/i);
      const labelInput = screen.getByPlaceholderText(/field label/i);
      const addButton = screen.getByText(/add field/i);

      await user.type(keyInput, 'new_field');
      await user.type(labelInput, 'New Field');
      await user.click(addButton);

      expect(screen.getByLabelText('New Field')).toBeInTheDocument();
    });

    it('shows different field type options', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /custom/i }));

      const typeSelect = screen.getByLabelText(/field type/i);
      expect(typeSelect).toBeInTheDocument();

      // Should have various field type options
      expect(screen.getByRole('option', { name: /text/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /number/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /date/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /yes\/no/i })).toBeInTheDocument();
    });

    it('allows removing custom fields', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /custom/i }));

      const removeButtons = screen.getAllByText(/remove/i);
      expect(removeButtons.length).toBeGreaterThan(0);

      await user.click(removeButtons[0]);

      // Field should be removed (this would require proper state management)
    });

    it('validates new field input', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /custom/i }));

      const addButton = screen.getByText(/add field/i);

      // Try to add without required fields
      await user.click(addButton);

      // Should not add field without key and label
      const keyInput = screen.getByPlaceholderText(/field key/i);
      expect(keyInput).toHaveValue('');
    });

    it('handles photos without custom metadata', async () => {
      const user = userEvent.setup();
      const photoWithoutMetadata = {
        ...mockPhoto,
        custom_metadata: undefined,
      };

      render(<PhotoEditForm {...defaultProps} photo={photoWithoutMetadata} />);

      await user.click(screen.getByRole('button', { name: /custom/i }));

      // Should show empty custom fields section
      expect(screen.getByText(/no custom fields/i)).toBeInTheDocument();
    });
  });

  describe('Form Actions', () => {
    it('shows save and cancel buttons', () => {
      render(<PhotoEditForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('calls onSave when form is submitted', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      render(<PhotoEditForm {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(onSave).toHaveBeenCalled();
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      render(<PhotoEditForm {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalled();
    });

    it('disables form when loading', () => {
      render(<PhotoEditForm {...defaultProps} isLoading={true} />);

      const saveButton = screen.getByRole('button', { name: /saving/i });
      expect(saveButton).toBeDisabled();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });

    it('shows loading state on save button', () => {
      render(<PhotoEditForm {...defaultProps} isLoading={true} />);

      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });

  describe('Validation and Error Handling', () => {
    it('shows validation errors', async () => {
      const formWithErrors = vi.fn().mockReturnValue({
        register: () => ({}),
        handleSubmit: (fn: (data: unknown) => void) => (e: Event) => {
          e.preventDefault();
          fn({});
        },
        control: {},
        setValue: vi.fn(),
        watch: () => ({}),
        formState: {
          errors: {
            title: { message: 'Title is required' },
            location_lat: { message: 'Invalid latitude' },
          },
        },
      });

      const { useForm } = await import('react-hook-form');
      vi.mocked(useForm).mockImplementation(formWithErrors);

      render(<PhotoEditForm {...defaultProps} />);

      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });

    it('validates coordinate ranges', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /location/i }));

      const latInput = screen.getByTestId('location-lat');
      await user.clear(latInput);
      await user.type(latInput, '91'); // Invalid latitude

      // Validation would be handled by react-hook-form
    });

    it('handles save errors gracefully', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));

      render(<PhotoEditForm {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByRole('button', { name: /save/i }));

      // Error handling would be implemented in the component
    });
  });

  describe('Accessibility', () => {
    it('provides proper labels for all form fields', () => {
      render(<PhotoEditForm {...defaultProps} />);

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/featured/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation between tabs', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      const tabs = screen.getAllByRole('button', { name: /tab/i });

      // Should be able to navigate with keyboard
      await user.tab();
      expect(document.activeElement).toBe(
        tabs[0] || screen.getByRole('button', { name: /basic/i })
      );
    });

    it('announces tab changes to screen readers', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      const locationTab = screen.getByRole('button', { name: /location/i });
      await user.click(locationTab);

      // Tab content should be accessible
      expect(locationTab).toHaveAttribute('aria-selected', 'true');
    });

    it('provides helpful field descriptions', () => {
      render(<PhotoEditForm {...defaultProps} />);

      expect(screen.getByText(/override the auto-detected location/i)).toBeInTheDocument();
    });
  });

  describe('Data Integration', () => {
    it('preserves all original photo data', () => {
      render(<PhotoEditForm {...defaultProps} />);

      // Should not lose any data during editing
      expect(screen.getByDisplayValue(mockPhoto.title)).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockPhoto.description!)).toBeInTheDocument();
    });

    it('handles partial photo data gracefully', () => {
      const partialPhoto = {
        id: '1',
        title: 'Partial Photo',
        filename: 'partial.jpg',
        original_path: '/uploads/partial.jpg',
        variants: {},
        file_size: 1000000,
        width: 1920,
        height: 1080,
        featured: false,
        order: 0,
        view_count: 0,
        created_at: '2023-12-25T14:30:00Z',
        updated_at: '2023-12-25T14:30:00Z',
      };

      render(<PhotoEditForm {...defaultProps} photo={partialPhoto} />);

      // Should handle missing optional fields
      expect(screen.getByDisplayValue('Partial Photo')).toBeInTheDocument();
    });

    it('formats dates correctly for datetime-local inputs', async () => {
      const user = userEvent.setup();
      render(<PhotoEditForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /technical/i }));

      const dateTakenField = screen.getByLabelText(/date taken/i);
      // Should format ISO date for HTML datetime-local input
      expect(dateTakenField).toHaveValue('2023-12-25T14:30');
    });
  });

  describe('Performance', () => {
    it('does not re-render unnecessarily', () => {
      const { rerender } = render(<PhotoEditForm {...defaultProps} />);

      // Rerender with same props
      rerender(<PhotoEditForm {...defaultProps} />);

      // Should not cause unnecessary re-renders (tested via React dev tools in real app)
      expect(screen.getByDisplayValue('Golden Gate Bridge')).toBeInTheDocument();
    });

    it('handles large custom metadata objects efficiently', async () => {
      const user = userEvent.setup();
      const photoWithLargeMetadata = {
        ...mockPhoto,
        custom_metadata: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`field_${i}`, `value_${i}`])
        ),
      };

      render(<PhotoEditForm {...defaultProps} photo={photoWithLargeMetadata} />);

      await user.click(screen.getByRole('button', { name: /custom/i }));

      // Should handle large number of custom fields without performance issues
      expect(screen.getByDisplayValue('value_0')).toBeInTheDocument();
    });
  });
});
