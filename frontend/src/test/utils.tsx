import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Test utilities and helpers
export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';

// Mock data factories
export const mockUser = {
  id: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  is_admin: false,
  is_active: true,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

export const mockAdminUser = {
  ...mockUser,
  id: 'admin-123',
  username: 'admin',
  email: 'admin@example.com',
  full_name: 'Admin User',
  is_admin: true,
};

export const mockPhoto = {
  id: 'photo-123',
  title: 'Test Photo',
  description: 'A test photo for testing',
  category: 'landscape',
  tags: ['nature', 'outdoor'],
  original_url: 'https://example.com/photo.jpg',
  thumbnail_url: 'https://example.com/photo_thumb.jpg',
  webp_url: 'https://example.com/photo.webp',
  width: 1920,
  height: 1080,
  file_size: 1024000,
  is_public: true,
  is_featured: false,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  exif_data: {
    make: 'Canon',
    model: 'EOS R5',
    lens: '24-70mm f/2.8',
    focal_length: '50mm',
    aperture: 'f/2.8',
    shutter_speed: '1/125s',
    iso: 400,
  },
};

export const mockProject = {
  id: 'project-123',
  title: 'Test Project',
  description: 'A test project for testing purposes',
  technologies: ['React', 'TypeScript', 'Vite'],
  github_url: 'https://github.com/test/project',
  demo_url: 'https://demo.test.com',
  status: 'completed' as const,
  is_featured: false,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

export const mockBlogPost = {
  id: 'post-123',
  title: 'Test Blog Post',
  slug: 'test-blog-post',
  content: 'This is test blog post content with **markdown** formatting.',
  excerpt: 'A test blog post excerpt',
  tags: ['web-development', 'testing'],
  is_published: true,
  status: 'published' as const,
  author_id: 'user-123',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  published_at: '2023-01-01T00:00:00Z',
  reading_time: { minutes: 5, text: '5 min read' },
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialRoute?: string;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    }),
    initialRoute = '/',
    ...renderOptions
  } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </BrowserRouter>
    );
  }

  // Navigate to initial route if not root
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock API responses
export const mockApiResponse = <T>(data: T, delay = 0) => {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
};

export const mockApiError = (message: string, status = 400, delay = 0) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(message) as any;
      error.response = { status, data: { detail: message } };
      reject(error);
    }, delay);
  });
};

// Mock file creation utilities
export const createMockFile = (
  name: string = 'test.jpg',
  type: string = 'image/jpeg',
  size: number = 1024
): File => {
  const content = new Array(size).fill('a').join('');
  return new File([content], name, { type });
};

export const createMockImageFile = (
  name: string = 'test-image.jpg',
  width: number = 800,
  height: number = 600
): File => {
  // Create a minimal JPEG-like blob
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, width, height);
  }
  
  const dataURL = canvas.toDataURL('image/jpeg');
  const byteString = atob(dataURL.split(',')[1]);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  
  return new File([arrayBuffer], name, { type: 'image/jpeg' });
};

// Mock drag and drop events
export const createMockDragEvent = (type: string, files: File[] = []): DragEvent => {
  const event = new DragEvent(type, {
    bubbles: true,
    cancelable: true,
  });
  
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      items: files.map(file => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      })),
      types: files.map(file => file.type),
    },
  });
  
  return event;
};

// Security test utilities
export const createXSSPayload = (tag: string = 'script') => {
  return `<${tag}>alert('XSS')</${tag}>`;
};

export const createSQLInjectionPayload = () => {
  return "'; DROP TABLE users; --";
};

// Authentication test utilities
export const mockAuthToken = 'mock-jwt-token-1234567890abcdef';

export const mockAuthenticatedUser = {
  ...mockUser,
  token: mockAuthToken,
};

// Local storage test utilities
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    store,
  };
};

// Form test utilities
export const fillForm = async (
  getByLabelText: any,
  formData: Record<string, string>
) => {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();
  
  for (const [label, value] of Object.entries(formData)) {
    const field = getByLabelText(new RegExp(label, 'i'));
    await user.clear(field);
    await user.type(field, value);
  }
};

// Network request mocking
export const mockFetch = (response: any, ok = true, status = 200) => {
  return vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
      headers: new Headers(),
      statusText: ok ? 'OK' : 'Error',
    } as Response)
  );
};

// Intersection Observer mock for lazy loading tests
export const mockIntersectionObserver = (isIntersecting = true) => {
  const mockObserve = vi.fn();
  const mockUnobserve = vi.fn();
  const mockDisconnect = vi.fn();
  
  const mockIntersectionObserver = vi.fn().mockImplementation((callback) => {
    // Call callback immediately with mock entry
    setTimeout(() => {
      callback([
        {
          isIntersecting,
          target: document.createElement('div'),
          boundingClientRect: {},
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: {},
          rootBounds: {},
          time: Date.now(),
        },
      ]);
    }, 0);
    
    return {
      observe: mockObserve,
      unobserve: mockUnobserve,
      disconnect: mockDisconnect,
    };
  });
  
  return {
    mockIntersectionObserver,
    mockObserve,
    mockUnobserve,
    mockDisconnect,
  };
};

// Error boundary test utility
export const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Wait for async operations
export const waitFor = (callback: () => void | Promise<void>, timeout = 1000) => {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    
    const check = async () => {
      try {
        await callback();
        resolve();
      } catch (error) {
        if (Date.now() - startTime > timeout) {
          reject(error);
        } else {
          setTimeout(check, 10);
        }
      }
    };
    
    check();
  });
};