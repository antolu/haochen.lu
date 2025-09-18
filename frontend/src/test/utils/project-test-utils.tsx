/**
 * Test utilities for project components
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { render, RenderOptions } from '@testing-library/react';

// Create a test query client with disabled retries for faster tests
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });

interface ProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

const AllProviders: React.FC<ProvidersProps> = ({
  children,
  queryClient = createTestQueryClient(),
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialRoute?: string;
}

export const renderWithProviders = (ui: React.ReactElement, options: CustomRenderOptions = {}) => {
  const { queryClient, initialRoute, ...renderOptions } = options;

  if (initialRoute) {
    window.history.pushState({}, 'Test', initialRoute);
  }

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AllProviders queryClient={queryClient}>{children}</AllProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock IntersectionObserver for infinite scroll tests
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = vi.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.IntersectionObserver = mockIntersectionObserver;
  return mockIntersectionObserver;
};

// Helper to trigger intersection observer
export const triggerIntersectionObserver = (isIntersecting: boolean = true) => {
  const mockObserver = window.IntersectionObserver as any;
  const callback = mockObserver.mock.calls[mockObserver.mock.calls.length - 1]?.[0];
  if (callback) {
    callback([{ isIntersecting }]);
  }
};

// Mock window.matchMedia for responsive tests
export const mockMatchMedia = (matches: boolean = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

// Helper to wait for async operations
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};
