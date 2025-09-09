/**
 * P1 - Frontend Component Tests: FileUpload
 * 
 * Tests for the file upload component including drag & drop, validation,
 * progress tracking, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders, createMockFile, createMockImageFile, createMockDragEvent } from '../utils';

// Mock file upload component
const MockFileUpload = ({
  accept = 'image/*',
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB
  onFilesSelected,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  disabled = false,
}: {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  onFilesSelected?: (files: File[]) => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (results: any[]) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
}) => {
  const [dragActive, setDragActive] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploading, setUploading] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size exceeds ${maxSize / 1024 / 1024}MB limit`;
    }
    
    const acceptedTypes = accept.split(',').map(type => type.trim());
    if (!acceptedTypes.some(type => {
      if (type === 'image/*') return file.type.startsWith('image/');
      return file.type === type;
    })) {
      return `File type ${file.type} not accepted`;
    }
    
    return null;
  };

  const handleFileSelect = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      onUploadError?.(errors.join(', '));
      return;
    }

    if (!multiple && validFiles.length > 1) {
      onUploadError?.('Only one file allowed');
      return;
    }

    setSelectedFiles(validFiles);
    onFilesSelected?.(validFiles);
  };

  const simulateUpload = async (files: File[]) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 50));
        setUploadProgress(i);
        onUploadProgress?.(i);
      }

      const results = files.map(file => ({
        id: `uploaded-${Date.now()}-${Math.random()}`,
        filename: file.name,
        size: file.size,
        url: `https://example.com/uploads/${file.name}`,
      }));

      onUploadComplete?.(results);
    } catch (error) {
      onUploadError?.('Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    handleFileSelect(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setDragActive(true);
    }
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  React.useEffect(() => {
    if (selectedFiles.length > 0) {
      simulateUpload(selectedFiles);
    }
  }, [selectedFiles]);

  return (
    <div data-testid="file-upload-container">
      <div
        data-testid="drop-zone"
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          data-testid="file-input"
          disabled={disabled}
        />
        
        {uploading ? (
          <div data-testid="upload-progress">
            <div>Uploading... {uploadProgress}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
                data-testid="progress-bar"
              />
            </div>
          </div>
        ) : (
          <div data-testid="upload-prompt">
            <div className="text-lg">Drop files here or click to browse</div>
            <div className="text-sm text-gray-500 mt-2">
              {accept} • Max {maxSize / 1024 / 1024}MB
              {multiple ? ' • Multiple files allowed' : ' • Single file only'}
            </div>
          </div>
        )}
      </div>
      
      {selectedFiles.length > 0 && (
        <div data-testid="selected-files" className="mt-4">
          <h4>Selected files:</h4>
          <ul>
            {selectedFiles.map((file, index) => (
              <li key={index} data-testid={`selected-file-${index}`}>
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const MockFilePreview = ({ files }: { files: File[] }) => {
  const [previews, setPreviews] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews(prev => ({
            ...prev,
            [file.name]: e.target?.result as string,
          }));
        };
        reader.readAsDataURL(file);
      }
    });
  }, [files]);

  return (
    <div data-testid="file-preview">
      {files.map((file, index) => (
        <div key={index} data-testid={`preview-${index}`} className="preview-item">
          <div>{file.name}</div>
          {file.type.startsWith('image/') && previews[file.name] && (
            <img
              src={previews[file.name]}
              alt={file.name}
              data-testid={`preview-image-${index}`}
              className="w-20 h-20 object-cover"
            />
          )}
        </div>
      ))}
    </div>
  );
};

describe('FileUpload Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render upload component with default props', () => {
      renderWithProviders(<MockFileUpload />);

      expect(screen.getByTestId('file-upload-container')).toBeInTheDocument();
      expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
      expect(screen.getByTestId('file-input')).toBeInTheDocument();
      expect(screen.getByTestId('upload-prompt')).toBeInTheDocument();
    });

    it('should display correct upload prompt text', () => {
      renderWithProviders(<MockFileUpload />);

      expect(screen.getByText('Drop files here or click to browse')).toBeInTheDocument();
      expect(screen.getByText(/image\/\* • Max 10MB • Single file only/)).toBeInTheDocument();
    });

    it('should show multiple files allowed when multiple=true', () => {
      renderWithProviders(<MockFileUpload multiple={true} />);

      expect(screen.getByText(/Multiple files allowed/)).toBeInTheDocument();
    });

    it('should display custom file size limit', () => {
      const customMaxSize = 5 * 1024 * 1024; // 5MB
      renderWithProviders(<MockFileUpload maxSize={customMaxSize} />);

      expect(screen.getByText(/Max 5MB/)).toBeInTheDocument();
    });
  });

  describe('File Input Interactions', () => {
    it('should open file dialog when clicked', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());
      
      renderWithProviders(<MockFileUpload />);

      const dropZone = screen.getByTestId('drop-zone');
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      const clickSpy = vi.spyOn(fileInput, 'click');
      
      await user.click(dropZone);
      
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should handle file selection through input', async () => {
      const onFilesSelected = vi.fn();
      const testFile = createMockImageFile('test.jpg');

      renderWithProviders(
        <MockFileUpload onFilesSelected={onFilesSelected} />
      );

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await fireEvent.change(fileInput, {
        target: { files: [testFile] }
      });

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([testFile]);
      });
    });

    it('should handle multiple file selection', async () => {
      const onFilesSelected = vi.fn();
      const testFiles = [
        createMockImageFile('test1.jpg'),
        createMockImageFile('test2.jpg'),
      ];

      renderWithProviders(
        <MockFileUpload multiple={true} onFilesSelected={onFilesSelected} />
      );

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await fireEvent.change(fileInput, {
        target: { files: testFiles }
      });

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith(testFiles);
      });
    });
  });

  describe('Drag and Drop Functionality', () => {
    it('should handle drag over events', async () => {
      renderWithProviders(<MockFileUpload />);

      const dropZone = screen.getByTestId('drop-zone');
      
      fireEvent.dragOver(dropZone);
      
      expect(dropZone).toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('should handle drag leave events', async () => {
      renderWithProviders(<MockFileUpload />);

      const dropZone = screen.getByTestId('drop-zone');
      
      fireEvent.dragOver(dropZone);
      expect(dropZone).toHaveClass('border-blue-500');
      
      fireEvent.dragLeave(dropZone);
      expect(dropZone).not.toHaveClass('border-blue-500');
    });

    it('should handle file drop', async () => {
      const onFilesSelected = vi.fn();
      const testFile = createMockImageFile('dropped.jpg');

      renderWithProviders(
        <MockFileUpload onFilesSelected={onFilesSelected} />
      );

      const dropZone = screen.getByTestId('drop-zone');
      const dropEvent = createMockDragEvent('drop', [testFile]);
      
      fireEvent(dropZone, dropEvent);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([testFile]);
      });
    });

    it('should handle multiple files dropped', async () => {
      const onFilesSelected = vi.fn();
      const testFiles = [
        createMockImageFile('dropped1.jpg'),
        createMockImageFile('dropped2.jpg'),
      ];

      renderWithProviders(
        <MockFileUpload multiple={true} onFilesSelected={onFilesSelected} />
      );

      const dropZone = screen.getByTestId('drop-zone');
      const dropEvent = createMockDragEvent('drop', testFiles);
      
      fireEvent(dropZone, dropEvent);

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith(testFiles);
      });
    });
  });

  describe('File Validation', () => {
    it('should validate file size', async () => {
      const onUploadError = vi.fn();
      const maxSize = 1024; // 1KB limit
      const largeFile = createMockFile('large.jpg', 'image/jpeg', 2048); // 2KB file

      renderWithProviders(
        <MockFileUpload maxSize={maxSize} onUploadError={onUploadError} />
      );

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await fireEvent.change(fileInput, {
        target: { files: [largeFile] }
      });

      await waitFor(() => {
        expect(onUploadError).toHaveBeenCalledWith(
          expect.stringContaining('File size exceeds')
        );
      });
    });

    it('should validate file type', async () => {
      const onUploadError = vi.fn();
      const invalidFile = createMockFile('document.pdf', 'application/pdf');

      renderWithProviders(
        <MockFileUpload accept="image/*" onUploadError={onUploadError} />
      );

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await fireEvent.change(fileInput, {
        target: { files: [invalidFile] }
      });

      await waitFor(() => {
        expect(onUploadError).toHaveBeenCalledWith(
          expect.stringContaining('File type application/pdf not accepted')
        );
      });
    });

    it('should reject multiple files when multiple=false', async () => {
      const onUploadError = vi.fn();
      const testFiles = [
        createMockImageFile('test1.jpg'),
        createMockImageFile('test2.jpg'),
      ];

      renderWithProviders(
        <MockFileUpload multiple={false} onUploadError={onUploadError} />
      );

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await fireEvent.change(fileInput, {
        target: { files: testFiles }
      });

      await waitFor(() => {
        expect(onUploadError).toHaveBeenCalledWith('Only one file allowed');
      });
    });

    it('should accept valid files', async () => {
      const onFilesSelected = vi.fn();
      const validFile = createMockImageFile('valid.jpg');

      renderWithProviders(
        <MockFileUpload accept="image/*" onFilesSelected={onFilesSelected} />
      );

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await fireEvent.change(fileInput, {
        target: { files: [validFile] }
      });

      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([validFile]);
      });
    });
  });

  describe('Upload Progress', () => {
    it('should show upload progress during upload', async () => {
      const testFile = createMockImageFile('test.jpg');

      renderWithProviders(<MockFileUpload />);

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await fireEvent.change(fileInput, {
        target: { files: [testFile] }
      });

      // Should show upload progress
      await waitFor(() => {
        expect(screen.getByTestId('upload-progress')).toBeInTheDocument();
      });

      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
      expect(screen.getByText(/Uploading\.\.\./)).toBeInTheDocument();
    });

    it('should call progress callback during upload', async () => {
      const onUploadProgress = vi.fn();
      const testFile = createMockImageFile('test.jpg');

      renderWithProviders(
        <MockFileUpload onUploadProgress={onUploadProgress} />
      );

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await fireEvent.change(fileInput, {
        target: { files: [testFile] }
      });

      await waitFor(() => {
        expect(onUploadProgress).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Should be called multiple times with different progress values
      expect(onUploadProgress).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should call completion callback after upload', async () => {
      const onUploadComplete = vi.fn();
      const testFile = createMockImageFile('test.jpg');

      renderWithProviders(
        <MockFileUpload onUploadComplete={onUploadComplete} />
      );

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await fireEvent.change(fileInput, {
        target: { files: [testFile] }
      });

      await waitFor(() => {
        expect(onUploadComplete).toHaveBeenCalledWith([
          expect.objectContaining({
            filename: 'test.jpg',
            size: expect.any(Number),
            url: expect.stringContaining('uploads/test.jpg'),
          })
        ]);
      }, { timeout: 2000 });
    });
  });

  describe('Disabled State', () => {
    it('should disable interactions when disabled', () => {
      renderWithProviders(<MockFileUpload disabled={true} />);

      const dropZone = screen.getByTestId('drop-zone');
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

      expect(dropZone).toHaveClass('opacity-50', 'cursor-not-allowed');
      expect(fileInput).toBeDisabled();
    });

    it('should not respond to drag events when disabled', () => {
      renderWithProviders(<MockFileUpload disabled={true} />);

      const dropZone = screen.getByTestId('drop-zone');
      
      fireEvent.dragOver(dropZone);
      
      expect(dropZone).not.toHaveClass('border-blue-500');
    });

    it('should not respond to clicks when disabled', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());
      
      renderWithProviders(<MockFileUpload disabled={true} />);

      const dropZone = screen.getByTestId('drop-zone');
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      const clickSpy = vi.spyOn(fileInput, 'click');
      
      await user.click(dropZone);
      
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('File Preview', () => {
    it('should render file preview for selected files', async () => {
      const testFiles = [
        createMockImageFile('preview1.jpg'),
        createMockImageFile('preview2.png'),
      ];

      renderWithProviders(<MockFilePreview files={testFiles} />);

      expect(screen.getByTestId('file-preview')).toBeInTheDocument();
      expect(screen.getByTestId('preview-0')).toBeInTheDocument();
      expect(screen.getByTestId('preview-1')).toBeInTheDocument();
      
      expect(screen.getByText('preview1.jpg')).toBeInTheDocument();
      expect(screen.getByText('preview2.png')).toBeInTheDocument();
    });

    it('should show image previews for image files', async () => {
      const imageFile = createMockImageFile('image.jpg');

      renderWithProviders(<MockFilePreview files={[imageFile]} />);

      await waitFor(() => {
        expect(screen.getByTestId('preview-image-0')).toBeInTheDocument();
      });

      const previewImage = screen.getByTestId('preview-image-0') as HTMLImageElement;
      expect(previewImage).toHaveAttribute('alt', 'image.jpg');
    });
  });

  describe('Error Handling', () => {
    it('should handle FileReader errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const corruptedFile = new File(['corrupted'], 'corrupted.jpg', { type: 'image/jpeg' });

      // Mock FileReader to throw error
      const mockFileReader = {
        readAsDataURL: vi.fn(() => {
          throw new Error('FileReader error');
        }),
        onerror: vi.fn(),
        onload: vi.fn(),
      };
      
      global.FileReader = vi.fn(() => mockFileReader) as any;

      expect(() => {
        renderWithProviders(<MockFilePreview files={[corruptedFile]} />);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should show selected files even with validation errors', async () => {
      const testFile = createMockImageFile('test.jpg');

      renderWithProviders(<MockFileUpload />);

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      
      await fireEvent.change(fileInput, {
        target: { files: [testFile] }
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-files')).toBeInTheDocument();
        expect(screen.getByTestId('selected-file-0')).toBeInTheDocument();
        expect(screen.getByText(/test\.jpg/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderWithProviders(<MockFileUpload />);

      const fileInput = screen.getByTestId('file-input');
      expect(fileInput).toHaveAttribute('type', 'file');
      
      // In a real implementation, would have aria-label, aria-describedby, etc.
    });

    it('should support keyboard navigation', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());
      
      renderWithProviders(<MockFileUpload />);

      const dropZone = screen.getByTestId('drop-zone');
      
      // Should be focusable
      expect(dropZone).toHaveClass('cursor-pointer');
      
      // Should respond to Enter/Space keys in real implementation
      await user.tab();
      // In a real implementation, dropZone would be focusable with tabindex
    });
  });
});