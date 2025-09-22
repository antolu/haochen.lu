import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query as string,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Ensure window.location exists for React Router in JSDOM
if (!window.location || !(window.location as unknown as { href?: string }).href) {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      assign: vi.fn((url: string) => {
        (window as unknown as { location: { href: string } }).location.href = url;
      }),
      replace: vi.fn(),
    },
  });
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock URL.createObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => 'mocked-url'),
});

Object.defineProperty(window.URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
});

// Mock Image constructor for image loading tests
(global as unknown as { Image: unknown }).Image = class {
  constructor() {
    setTimeout(() => {
      this.onload?.();
    }, 0);
  }
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  alt = '';
  width = 0;
  height = 0;
} as any;

// Mock File constructor
(global as unknown as { File: unknown }).File = class File {
  constructor(
    chunks: (string | ArrayBuffer | ArrayBufferView | Blob)[],
    filename: string,
    options?: { type?: string }
  ) {
    this.name = filename;
    this.size = chunks.reduce(
      (acc: number, chunk: string | ArrayBuffer | ArrayBufferView | Blob) =>
        acc + (chunk as { length: number }).length,
      0
    );
    this.type = options?.type ?? '';
    this.lastModified = Date.now();
  }
  name: string;
  size: number;
  type: string;
  lastModified: number;
  stream() {
    return new ReadableStream();
  }
  text() {
    return Promise.resolve('');
  }
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0));
  }
  slice() {
    return new File([], this.name);
  }
} as any;

// Mock FileReader
(global as unknown as { FileReader: unknown }).FileReader = class FileReader {
  readAsDataURL() {
    setTimeout(() => {
      this.onload?.({
        target: { result: 'data:image/jpeg;base64,mock-image-data' },
      } as any);
    }, 0);
  }
  readAsText() {
    setTimeout(() => {
      this.onload?.({
        target: { result: 'mock text content' },
      } as any);
    }, 0);
  }
  onload: ((event: any) => void) | null = null;
  onerror: (() => void) | null = null;
  result: string | ArrayBuffer | null = null;
} as any;

// Mock crypto.randomUUID
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'mock-uuid-1234-5678-9abc-def0'),
  },
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// Global test utilities
beforeAll(() => {
  // Setup any global test state
});

afterAll(() => {
  // Cleanup any global test state

  // Force cleanup of any hanging processes
  if (typeof global.gc === 'function') {
    global.gc();
  }

  // Clear all timers
  vi.clearAllTimers();
  vi.useRealTimers();
});
