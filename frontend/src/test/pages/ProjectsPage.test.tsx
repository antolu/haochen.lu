/**
 * ProjectsPage Component Tests
 *
 * Comprehensive tests for the ProjectsPage including:
 * - Page rendering and hero section
 * - Search functionality and filtering
 * - Project grid integration
 * - Error handling and loading states
 * - Filter buttons and user interactions
 * - Statistics display and responsive behavior
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectsPage from '../../pages/ProjectsPage';
import { mockProjects, mockProjectsListResponse } from '../fixtures/projects';
import { renderWithProviders } from '../utils/project-test-utils';
// import * as useProjectsModule from '../../hooks/useProjects';  // Unused but kept for future test enhancements

// Mock the useInfiniteProjects hook
const mockUseInfiniteProjects = vi.fn(() => ({}));
vi.mock('../../hooks/useProjects', async () => {
  const actual = await vi.importActual('../../hooks/useProjects');
  return {
    ...actual,
    useInfiniteProjects: (...args: unknown[]) => mockUseInfiniteProjects(...args),
  };
});

// Mock ProjectGrid component
vi.mock('../../components/ProjectGrid', () => ({
  default: ({
    projects,
    onLoadMore,
    hasMore,
    isLoading,
    isLoadingMore,
  }: {
    projects: { id: string; title: string }[];
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoading?: boolean;
    isLoadingMore?: boolean;
  }) => (
    <div data-testid="project-grid">
      <div data-testid="project-count">{projects?.length ?? 0}</div>
      <div data-testid="loading-state">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="loading-more-state">
        {isLoadingMore ? 'loading-more' : 'not-loading-more'}
      </div>
      <div data-testid="has-more">{hasMore ? 'has-more' : 'no-more'}</div>
      {onLoadMore && (
        <button onClick={onLoadMore} data-testid="load-more-button">
          Load More
        </button>
      )}
      {projects?.map((project: { id: string; title: string }) => (
        <div key={project.id} data-testid={`project-${project.id}`}>
          {project.title}
        </div>
      ))}
    </div>
  ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('ProjectsPage', () => {
  const mockFetchNextPage = vi.fn();

  const defaultMockReturn = {
    data: {
      pages: [mockProjectsListResponse],
    },
    fetchNextPage: mockFetchNextPage,
    hasNextPage: true,
    isFetchingNextPage: false,
    isLoading: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInfiniteProjects.mockReturnValue(defaultMockReturn);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Rendering', () => {
    it('renders the hero section with correct content', () => {
      renderWithProviders(<ProjectsPage />);

      expect(screen.getByText('Projects & Work')).toBeInTheDocument();
      expect(
        screen.getByText(/Explore my portfolio of applications, tools, and experiments/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/From web applications to open-source contributions/)
      ).toBeInTheDocument();
    });

    it('displays project statistics in hero section', () => {
      renderWithProviders(<ProjectsPage />);

      expect(screen.getByText(`${mockProjectsListResponse.total} Projects`)).toBeInTheDocument();
      expect(screen.getByText('Open Source & Commercial')).toBeInTheDocument();
      expect(screen.getByText('Continuously Updated')).toBeInTheDocument();
    });

    it('renders search input and filter buttons', () => {
      renderWithProviders(<ProjectsPage />);

      expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Featured' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'In Progress' })).toBeInTheDocument();
    });

    it('renders project grid component', () => {
      renderWithProviders(<ProjectsPage />);

      expect(screen.getByTestId('project-grid')).toBeInTheDocument();
      expect(screen.getByTestId('project-count')).toHaveTextContent(mockProjects.length.toString());
    });

    it('shows results count', () => {
      renderWithProviders(<ProjectsPage />);

      expect(
        screen.getByText(
          `Showing ${mockProjects.length} of ${mockProjectsListResponse.total} projects`
        )
      ).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading state initially', () => {
      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        data: undefined,
      });

      renderWithProviders(<ProjectsPage />);

      expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');
      expect(screen.queryByText(/Showing \d+ of \d+ projects/)).not.toBeInTheDocument();
    });

    it('shows loading more state', () => {
      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        isFetchingNextPage: true,
      });

      renderWithProviders(<ProjectsPage />);

      expect(screen.getByTestId('loading-more-state')).toHaveTextContent('loading-more');
    });

    it('passes correct loading states to ProjectGrid', () => {
      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        isFetchingNextPage: true,
      });

      renderWithProviders(<ProjectsPage />);

      expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');
      expect(screen.getByTestId('loading-more-state')).toHaveTextContent('loading-more');
    });
  });

  describe('Error Handling', () => {
    it('shows error state when query fails', () => {
      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        error: new Error('Failed to fetch projects'),
      });

      renderWithProviders(<ProjectsPage />);

      expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
      expect(
        screen.getByText('There was an error loading the projects. Please try again.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('provides retry functionality on error', async () => {
      const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        error: new Error('Failed to fetch projects'),
      });

      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      await user.click(retryButton);

      expect(reloadSpy).toHaveBeenCalled();
      reloadSpy.mockRestore();
    });

    it('shows error icon in error state', () => {
      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        error: new Error('Failed to fetch projects'),
      });

      renderWithProviders(<ProjectsPage />);

      const errorIcon = screen
        .getByText('Failed to load projects')
        .closest('div')
        ?.querySelector('svg');
      expect(errorIcon).toBeInTheDocument();
      expect(errorIcon).toHaveClass('text-red-500');
    });
  });

  describe('Search Functionality', () => {
    it('updates search query when user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'react');

      expect(searchInput).toHaveValue('react');
    });

    it('calls useInfiniteProjects with search filter', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'react');

      await waitFor(() => {
        expect(mockUseInfiniteProjects).toHaveBeenCalledWith({
          search: 'react',
        });
      });
    });

    it('shows search results indicator', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'react');

      await waitFor(() => {
        expect(screen.getByText(/Search results for "react"/)).toBeInTheDocument();
      });
    });

    it('handles form submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'react');

      // Submit form by pressing Enter
      fireEvent.submit(searchInput.closest('form')!);

      // Should not cause any errors
      expect(searchInput).toHaveValue('react');
    });

    it('shows search icon in input field', () => {
      renderWithProviders(<ProjectsPage />);

      const searchIcon = screen
        .getByPlaceholderText('Search projects...')
        .parentElement?.querySelector('svg');
      expect(searchIcon).toBeInTheDocument();
      expect(searchIcon).toHaveClass('text-gray-400');
    });
  });

  describe('Filter Functionality', () => {
    it('activates "All" filter by default', () => {
      renderWithProviders(<ProjectsPage />);

      const allButton = screen.getByRole('button', { name: 'All' });
      expect(allButton).toHaveClass('bg-blue-600', 'text-white');
    });

    it('handles featured filter click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const featuredButton = screen.getByRole('button', { name: 'Featured' });
      await user.click(featuredButton);

      expect(mockUseInfiniteProjects).toHaveBeenCalledWith({
        featured: true,
        search: undefined,
      });
      expect(featuredButton).toHaveClass('bg-blue-600', 'text-white');
    });

    it('handles active status filter click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const activeButton = screen.getByRole('button', { name: 'Active' });
      await user.click(activeButton);

      expect(mockUseInfiniteProjects).toHaveBeenCalledWith({
        status: 'active',
        search: undefined,
      });
      expect(activeButton).toHaveClass('bg-blue-600', 'text-white');
    });

    it('handles in progress status filter click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const inProgressButton = screen.getByRole('button', {
        name: 'In Progress',
      });
      await user.click(inProgressButton);

      expect(mockUseInfiniteProjects).toHaveBeenCalledWith({
        status: 'in_progress',
        search: undefined,
      });
      expect(inProgressButton).toHaveClass('bg-blue-600', 'text-white');
    });

    it('resets filters when "All" is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      // First activate a filter
      const featuredButton = screen.getByRole('button', { name: 'Featured' });
      await user.click(featuredButton);

      // Then click "All" to reset
      const allButton = screen.getByRole('button', { name: 'All' });
      await user.click(allButton);

      expect(mockUseInfiniteProjects).toHaveBeenCalledWith({
        search: undefined,
      });
      expect(allButton).toHaveClass('bg-blue-600', 'text-white');
    });

    it('shows inactive styling for non-active filters', () => {
      renderWithProviders(<ProjectsPage />);

      const featuredButton = screen.getByRole('button', { name: 'Featured' });
      expect(featuredButton).toHaveClass('bg-white', 'text-gray-700', 'border', 'border-gray-300');
    });
  });

  describe('Project Grid Integration', () => {
    it('passes projects to ProjectGrid', () => {
      renderWithProviders(<ProjectsPage />);

      expect(screen.getByTestId('project-count')).toHaveTextContent(mockProjects.length.toString());

      mockProjects.forEach(project => {
        expect(screen.getByTestId(`project-${project.id}`)).toBeInTheDocument();
      });
    });

    it('passes pagination props to ProjectGrid', () => {
      renderWithProviders(<ProjectsPage />);

      expect(screen.getByTestId('has-more')).toHaveTextContent('has-more');
      expect(screen.getByTestId('load-more-button')).toBeInTheDocument();
    });

    it('handles load more functionality', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const loadMoreButton = screen.getByTestId('load-more-button');
      await user.click(loadMoreButton);

      expect(mockFetchNextPage).toHaveBeenCalled();
    });

    it('handles multiple pages of data', () => {
      const secondPageProjects = Array(5)
        .fill(null)
        .map((_, i) => ({
          ...mockProjects[0],
          id: `page2-project-${i}`,
          title: `Page 2 Project ${i}`,
        }));

      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        data: {
          pages: [
            mockProjectsListResponse,
            {
              projects: secondPageProjects,
              total: mockProjectsListResponse.total + 5,
            },
          ],
        },
      });

      renderWithProviders(<ProjectsPage />);

      // Should show all projects from both pages
      const totalProjects = mockProjects.length + secondPageProjects.length;
      expect(screen.getByTestId('project-count')).toHaveTextContent(totalProjects.toString());
    });

    it('handles empty results', () => {
      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        data: {
          pages: [{ projects: [], total: 0 }],
        },
      });

      renderWithProviders(<ProjectsPage />);

      expect(screen.getByTestId('project-count')).toHaveTextContent('0');
      expect(screen.getByText('Showing 0 of 0 projects')).toBeInTheDocument();
    });
  });

  describe('Combined Search and Filter', () => {
    it('combines search and filter parameters', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      // Apply search
      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'react');

      // Apply filter
      const featuredButton = screen.getByRole('button', { name: 'Featured' });
      await user.click(featuredButton);

      await waitFor(() => {
        expect(mockUseInfiniteProjects).toHaveBeenCalledWith({
          featured: true,
          search: 'react',
        });
      });
    });

    it('shows combined search and filter results indicator', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'typescript');

      const activeButton = screen.getByRole('button', { name: 'Active' });
      await user.click(activeButton);

      await waitFor(() => {
        expect(screen.getByText(/Search results for "typescript"/)).toBeInTheDocument();
        expect(activeButton).toHaveClass('bg-blue-600', 'text-white');
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('has responsive layout classes', () => {
      renderWithProviders(<ProjectsPage />);

      // Check for responsive grid classes
      const heroSection = screen.getByText('Projects & Work').closest('section');
      expect(heroSection).toHaveClass('bg-gradient-to-br');

      const contentSection = screen.getByTestId('project-grid').closest('section');
      expect(contentSection).toHaveClass('py-12');
    });

    it('has responsive container classes', () => {
      renderWithProviders(<ProjectsPage />);

      const containers = document.querySelectorAll('.max-w-7xl.mx-auto');
      expect(containers.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithProviders(<ProjectsPage />);

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Projects & Work');
    });

    it('has accessible search form', () => {
      renderWithProviders(<ProjectsPage />);

      const searchInput = screen.getByRole('textbox');
      expect(searchInput).toHaveAttribute('placeholder', 'Search projects...');
    });

    it('has accessible filter buttons', () => {
      renderWithProviders(<ProjectsPage />);

      const filterButtons = screen.getAllByRole('button');
      const namedButtons = filterButtons.filter(button =>
        ['All', 'Featured', 'Active', 'In Progress'].includes(button.textContent ?? '')
      );

      expect(namedButtons).toHaveLength(4);
      namedButtons.forEach(button => {
        expect(button).toBeEnabled();
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByPlaceholderText('Search projects...')).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: 'All' })).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined data gracefully', () => {
      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        data: undefined,
      });

      renderWithProviders(<ProjectsPage />);

      expect(screen.getByTestId('project-count')).toHaveTextContent('0');
      expect(screen.getByText('Showing 0 of 0 projects')).toBeInTheDocument();
    });

    it('handles empty pages array', () => {
      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        data: { pages: [] },
      });

      renderWithProviders(<ProjectsPage />);

      expect(screen.getByTestId('project-count')).toHaveTextContent('0');
      expect(screen.getByText('Showing 0 of 0 projects')).toBeInTheDocument();
    });

    it('handles missing total count', () => {
      mockUseInfiniteProjects.mockReturnValue({
        ...defaultMockReturn,
        data: {
          pages: [{ projects: mockProjects }], // No total property
        },
      });

      renderWithProviders(<ProjectsPage />);

      expect(screen.getByText('0 Projects')).toBeInTheDocument(); // Falls back to 0
      expect(screen.getByText('Showing 4 of 0 projects')).toBeInTheDocument();
    });

    it('handles empty search query', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProjectsPage />);

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'test');
      await user.clear(searchInput);

      await waitFor(() => {
        expect(mockUseInfiniteProjects).toHaveBeenCalledWith({
          search: undefined,
        });
      });
    });
  });
});
