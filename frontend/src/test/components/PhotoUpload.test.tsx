/**
 * Comprehensive PhotoUpload Component Tests
 *
 * Tests covering all scenarios including empty form fields, file validation,
 * error handling, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders } from '../utils';
import PhotoUpload from '../../components/PhotoUpload';
import * as api from '../../api/client';

// Mock the API
vi.mock('../../api/client', () => ({
  photos: {
    upload: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock react-dropzone to make testing easier
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(({ onDrop, accept, maxSize, multiple, disabled }) => ({
    getRootProps: () => ({
      'data-testid': 'drop-zone',
      onClick: () => {
        // Simulate file selection
        const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
        onDrop([mockFile]);
      },
    }),
    getInputProps: () => ({
      'data-testid': 'file-input',
      type: 'file',
      onChange: (e: any) => {
        if (e.target.files) {
          onDrop(Array.from(e.target.files));
        }
      },
    }),
    isDragActive: false,
  })),
}));

const createTestFile = (
  name: string = 'test.jpg',
  size: number = 1024 * 1024,
  type: string = 'image/jpeg'
): File => {
  return new File(['test content'.repeat(size / 12)], name, { type });
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('PhotoUpload Component Tests', () => {
  let mockOnComplete: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;
  let mockUpload: ReturnType<typeof vi.fn>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockOnComplete = vi.fn();
    mockOnCancel = vi.fn();
    mockUpload = vi.fn().mockResolvedValue({
      id: 'test-photo-id',
      title: 'Test Photo',
      filename: 'test.jpg',
      webp_path: '/images/test.webp',
      thumbnail_path: '/images/thumb_test.jpg',
      created_at: new Date().toISOString(),
    });

    // Mock the API
    (api.photos.upload as any) = mockUpload;

    user = userEvent.setup();

    // Clear URL mock counters
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderPhotoUpload = (props = {}) => {
    const queryClient = createQueryClient();
    return renderWithProviders(
      <QueryClientProvider client={queryClient}>
        <PhotoUpload onComplete={mockOnComplete} onCancel={mockOnCancel} {...props} />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the upload component', () => {
      renderPhotoUpload();

      expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
      expect(screen.getByTestId('file-input')).toBeInTheDocument();
      expect(screen.getByText(/drag.*drop.*files/i)).toBeInTheDocument();
    });

    it('should render form fields with empty defaults', () => {
      renderPhotoUpload();

      expect(screen.getByLabelText(/title/i)).toHaveValue('');
      expect(screen.getByLabelText(/description/i)).toHaveValue('');
      expect(screen.getByLabelText(/category/i)).toHaveValue('');
      expect(screen.getByLabelText(/tags/i)).toHaveValue('');
      expect(screen.getByLabelText(/featured/i)).not.toBeChecked();
    });
  });

  describe('File Validation', () => {
    it('should accept valid image files', async () => {
      renderPhotoUpload();

      const file = createTestFile('valid.jpg', 1024, 'image/jpeg');
      const dropzone = screen.getByTestId('drop-zone');

      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('valid.jpg')).toBeInTheDocument();
      });
    });

    it('should reject files that are too large', async () => {
      renderPhotoUpload();

      const largeFile = createTestFile('large.jpg', 60 * 1024 * 1024, 'image/jpeg'); // 60MB

      // Mock the onDrop to simulate large file rejection
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      // In the actual component, large files would be filtered out
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('File too large'),
        'large.jpg',
        60 * 1024 * 1024
      );

      consoleSpy.mockRestore();
    });

    it('should reject empty files', async () => {
      renderPhotoUpload();

      const emptyFile = createTestFile('empty.jpg', 0, 'image/jpeg');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Empty file received'),
        'empty.jpg'
      );

      consoleSpy.mockRestore();
    });

    it('should reject files without names', async () => {
      renderPhotoUpload();

      const fileWithoutName = createTestFile('', 1024, 'image/jpeg');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('File missing name property')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Empty Form Field Scenarios', () => {
    it('should upload with completely empty form fields', async () => {
      renderPhotoUpload();

      // Add a file
      const file = createTestFile('test.jpg');
      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      // Submit with all empty fields
      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(expect.any(File), {
          title: 'test', // Should use filename without extension
          description: '',
          category: '',
          tags: '',
          comments: '',
          featured: false,
        });
      });
    });

    it('should upload with only title filled', async () => {
      renderPhotoUpload();

      // Add file
      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      // Fill only title
      await user.type(screen.getByLabelText(/title/i), 'My Custom Title');

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(expect.any(File), {
          title: 'My Custom Title',
          description: '',
          category: '',
          tags: '',
          comments: '',
          featured: false,
        });
      });
    });

    it('should upload with partial form data', async () => {
      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      // Fill some fields, leave others empty
      await user.type(screen.getByLabelText(/title/i), 'Partial Title');
      await user.type(screen.getByLabelText(/category/i), 'landscape');
      await user.click(screen.getByLabelText(/featured/i));
      // Leave description and tags empty

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(expect.any(File), {
          title: 'Partial Title',
          description: '',
          category: 'landscape',
          tags: '',
          comments: '',
          featured: true,
        });
      });
    });

    it('should handle whitespace-only fields', async () => {
      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      // Fill fields with whitespace
      await user.type(screen.getByLabelText(/title/i), '   ');
      await user.type(screen.getByLabelText(/description/i), '\t\n  ');
      await user.type(screen.getByLabelText(/category/i), '  nature  ');

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(expect.any(File), {
          title: 'test', // Should fallback to filename since title is whitespace
          description: '',
          category: 'nature', // Should be trimmed
          tags: '',
          comments: '',
          featured: false,
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 422 validation errors', async () => {
      const validationError = {
        response: {
          status: 422,
          data: { detail: 'File validation failed. Invalid image format.' },
        },
      };
      mockUpload.mockRejectedValue(validationError);

      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/file validation failed/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      const networkError = {
        request: {},
        message: 'Network Error',
      };
      mockUpload.mockRejectedValue(networkError);

      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should handle file too large errors', async () => {
      const fileTooLargeError = {
        response: {
          status: 413,
          data: { detail: 'Request Entity Too Large' },
        },
      };
      mockUpload.mockRejectedValue(fileTooLargeError);

      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/file is too large/i)).toBeInTheDocument();
      });
    });

    it('should handle server errors', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { detail: 'Internal Server Error' },
        },
      };
      mockUpload.mockRejectedValue(serverError);

      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/server error occurred/i)).toBeInTheDocument();
      });
    });

    it('should handle authorization errors', async () => {
      const authError = {
        response: {
          status: 401,
          data: { detail: 'Unauthorized' },
        },
      };
      mockUpload.mockRejectedValue(authError);

      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/not authorized to upload/i)).toBeInTheDocument();
      });
    });
  });

  describe('Multiple File Upload', () => {
    it('should handle multiple files with mixed form data', async () => {
      renderPhotoUpload();

      // Simulate multiple file selection
      const files = [
        createTestFile('photo1.jpg'),
        createTestFile('photo2.png', 2048, 'image/png'),
        createTestFile('photo3.webp', 1536, 'image/webp'),
      ];

      // Mock multiple files
      vi.mocked(require('react-dropzone').useDropzone).mockImplementation(({ onDrop }) => ({
        getRootProps: () => ({
          'data-testid': 'drop-zone',
          onClick: () => onDrop(files),
        }),
        getInputProps: () => ({ 'data-testid': 'file-input' }),
        isDragActive: false,
      }));

      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('photo1.jpg')).toBeInTheDocument();
        expect(screen.getByText('photo2.png')).toBeInTheDocument();
        expect(screen.getByText('photo3.webp')).toBeInTheDocument();
      });

      // Fill form with some data
      await user.type(screen.getByLabelText(/description/i), 'Batch upload test');
      await user.type(screen.getByLabelText(/category/i), 'test');

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(3);

        // Check that each file was uploaded with correct metadata
        expect(mockUpload).toHaveBeenCalledWith(
          files[0],
          expect.objectContaining({
            title: 'photo1',
            description: 'Batch upload test',
            category: 'test',
          })
        );

        expect(mockUpload).toHaveBeenCalledWith(
          files[1],
          expect.objectContaining({
            title: 'photo2',
            description: 'Batch upload test',
            category: 'test',
          })
        );

        expect(mockUpload).toHaveBeenCalledWith(
          files[2],
          expect.objectContaining({
            title: 'photo3',
            description: 'Batch upload test',
            category: 'test',
          })
        );
      });
    });
  });

  describe('File Management', () => {
    it('should allow removing files before upload', async () => {
      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      // Remove the file
      const removeButton = screen.getByRole('button', { name: /remove/i });
      await user.click(removeButton);

      expect(screen.queryByText('test.jpg')).not.toBeInTheDocument();

      // Should not be able to submit without files
      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('should cleanup preview URLs on unmount', () => {
      const { unmount } = renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      unmount();

      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });
  });

  describe('Upload Progress and Status', () => {
    it('should show upload progress during upload', async () => {
      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      // Make upload take some time
      mockUpload.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      // Should show uploading status
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText(/completed/i)).toBeInTheDocument();
      });
    });

    it('should call onComplete when all uploads finish', async () => {
      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined file objects gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderPhotoUpload();

      // Simulate corrupted file list
      vi.mocked(require('react-dropzone').useDropzone).mockImplementation(({ onDrop }) => ({
        getRootProps: () => ({
          'data-testid': 'drop-zone',
          onClick: () => onDrop([undefined, null] as any),
        }),
        getInputProps: () => ({ 'data-testid': 'file-input' }),
        isDragActive: false,
      }));

      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid file object received')
      );

      consoleSpy.mockRestore();
    });

    it('should handle very long filenames', async () => {
      renderPhotoUpload();

      const longFilename = 'a'.repeat(255) + '.jpg';
      const longFile = createTestFile(longFilename);

      vi.mocked(require('react-dropzone').useDropzone).mockImplementation(({ onDrop }) => ({
        getRootProps: () => ({
          'data-testid': 'drop-zone',
          onClick: () => onDrop([longFile]),
        }),
        getInputProps: () => ({ 'data-testid': 'file-input' }),
        isDragActive: false,
      }));

      renderPhotoUpload();

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText(longFilename)).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(
          longFile,
          expect.objectContaining({
            title: 'a'.repeat(255), // Should remove extension
          })
        );
      });
    });

    it('should prevent upload with no files selected', async () => {
      renderPhotoUpload();

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('should handle max file limit', async () => {
      renderPhotoUpload({ maxFiles: 2 });

      const files = [
        createTestFile('file1.jpg'),
        createTestFile('file2.jpg'),
        createTestFile('file3.jpg'), // Should be rejected
      ];

      vi.mocked(require('react-dropzone').useDropzone).mockImplementation(({ onDrop }) => ({
        getRootProps: () => ({
          'data-testid': 'drop-zone',
          onClick: () => onDrop(files),
        }),
        getInputProps: () => ({ 'data-testid': 'file-input' }),
        isDragActive: false,
      }));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderPhotoUpload({ maxFiles: 2 });

      const dropzone = screen.getByTestId('drop-zone');
      fireEvent.click(dropzone);

      await waitFor(() => {
        expect(screen.getByText('file1.jpg')).toBeInTheDocument();
        expect(screen.getByText('file2.jpg')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Only processing 2 of 3 files due to upload limit')
      );

      consoleSpy.mockRestore();
    });
  });
});
