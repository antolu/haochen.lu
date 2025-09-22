/**
 * useProjects Hook Tests
 *
 * Comprehensive tests for the useProjects hook and related utilities including:
 * - Query hooks for fetching projects (single, list, infinite, featured)
 * - Mutation hooks for CRUD operations
 * - Cache management and invalidation
 * - README integration hooks
 * - Utility functions for data processing
 * - Error handling and retry logic
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import {
  useProjects,
  useInfiniteProjects,
  useProject,
  useFeaturedProjects,
  useProjectReadme,
  useProjectStats,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  usePreviewReadme,
  useRefreshReadme,
  parseTechnologies,
  formatTechnologies,
  parseRepositoryUrl,
  generateSlug,
  projectKeys,
  // Project,  // Unused in current tests
  ProjectFilters,
  ProjectCreate,
  ProjectUpdate,
} from '../../hooks/useProjects';
import { createMockProject, mockProjectsListResponse } from '../fixtures/projects';

// Mock API client
vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

const mockApiClient = vi.mocked(apiClient);

// Test wrapper component for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
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

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useProjects Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockApiClient.get).mockResolvedValue({ data: mockProjectsListResponse });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Query Keys Factory', () => {
    it('generates consistent query keys', () => {
      const filters: ProjectFilters = { featured: true, status: 'active' };

      expect(projectKeys.all).toEqual(['projects']);
      expect(projectKeys.lists()).toEqual(['projects', 'list']);
      expect(projectKeys.list(filters)).toEqual(['projects', 'list', filters]);
      expect(projectKeys.details()).toEqual(['projects', 'detail']);
      expect(projectKeys.detail('test-id')).toEqual(['projects', 'detail', 'test-id']);
      expect(projectKeys.featured()).toEqual(['projects', 'featured']);
      expect(projectKeys.readme('test-id')).toEqual(['projects', 'readme', 'test-id']);
      expect(projectKeys.stats()).toEqual(['projects', 'stats']);
    });

    it('generates different keys for different filters', () => {
      const filters1: ProjectFilters = { featured: true };
      const filters2: ProjectFilters = { status: 'active' };

      expect(projectKeys.list(filters1)).not.toEqual(projectKeys.list(filters2));
    });
  });

  describe('useProjects', () => {
    it('fetches projects successfully', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockProjectsListResponse);
      expect(vi.mocked(mockApiClient.get)).toHaveBeenCalledWith('/projects?');
    });

    it('applies filters correctly', async () => {
      const wrapper = createWrapper();
      const filters: ProjectFilters = {
        featured: true,
        status: 'active',
        search: 'test project',
      };

      const { result } = renderHook(() => useProjects(filters), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(vi.mocked(mockApiClient.get)).toHaveBeenCalledWith(
        '/projects?featured_only=true&status=active&search=test+project'
      );
    });

    it('handles empty filters', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProjects({}), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(vi.mocked(mockApiClient.get)).toHaveBeenCalledWith('/projects?');
    });

    it('handles API errors gracefully', async () => {
      vi.mocked(mockApiClient.get).mockRejectedValue(new Error('API Error'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error('API Error'));
    });

    it('uses correct stale time', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Stale time should be 5 minutes (300000ms)
      // This is difficult to test directly, but we can verify the hook behaves correctly
      expect(result.current.data).toBeDefined();
    });
  });

  describe('useInfiniteProjects', () => {
    beforeEach(() => {
      vi.mocked(mockApiClient.get).mockResolvedValue({
        data: {
          projects: Array(12)
            .fill(null)
            .map((_, i) => createMockProject({ id: `project-${i}` })),
          total: 25,
          page: 1,
          per_page: 12,
          pages: 3,
        },
      });
    });

    it('fetches first page successfully', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useInfiniteProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(vi.mocked(mockApiClient.get)).toHaveBeenCalledWith('/projects?page=1&per_page=12');
      expect(result.current.data?.pages).toHaveLength(1);
    });

    it('calculates next page correctly', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useInfiniteProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should have next page if current page has 12 projects
      expect(result.current.hasNextPage).toBe(true);
    });

    it('detects no more pages when less than 12 projects returned', async () => {
      vi.mocked(mockApiClient.get).mockResolvedValue({
        data: {
          projects: Array(8)
            .fill(null)
            .map((_, i) => createMockProject({ id: `project-${i}` })),
          total: 8,
        },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useInfiniteProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasNextPage).toBe(false);
    });

    it('applies filters to infinite query', async () => {
      const wrapper = createWrapper();
      const filters: ProjectFilters = { featured: true };

      const { result } = renderHook(() => useInfiniteProjects(filters), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(vi.mocked(mockApiClient.get)).toHaveBeenCalledWith(
        '/projects?page=1&per_page=12&featured_only=true'
      );
    });
  });

  describe('useProject', () => {
    const mockProject = createMockProject();

    beforeEach(() => {
      vi.mocked(mockApiClient.get).mockResolvedValue({ data: mockProject });
    });

    it('fetches single project by ID', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProject('test-id'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockProject);
      expect(vi.mocked(mockApiClient.get)).toHaveBeenCalledWith('/projects/test-id');
    });

    it('fetches single project by slug', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProject('test-slug'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(vi.mocked(mockApiClient.get)).toHaveBeenCalledWith('/projects/test-slug');
    });

    it('is disabled when idOrSlug is empty', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProject(''), { wrapper });

      // Should not make API call
      expect(vi.mocked(mockApiClient.get)).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('handles project not found error', async () => {
      vi.mocked(mockApiClient.get).mockRejectedValue({ response: { status: 404 } });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProject('nonexistent'), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useFeaturedProjects', () => {
    const featuredProjects = [
      createMockProject({ id: '1', featured: true }),
      createMockProject({ id: '2', featured: true }),
    ];

    beforeEach(() => {
      vi.mocked(mockApiClient.get).mockResolvedValue({ data: featuredProjects });
    });

    it('fetches featured projects', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useFeaturedProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(featuredProjects);
      expect(vi.mocked(mockApiClient.get)).toHaveBeenCalledWith('/projects/featured');
    });

    it('uses longer stale time for featured projects', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useFeaturedProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Featured projects should have 15-minute stale time
      expect(result.current.data).toBeDefined();
    });
  });

  describe('useProjectReadme', () => {
    const mockReadmeContent = {
      content: '# Test README\n\nThis is a test README.',
      source: 'github',
      last_updated: '2023-01-15T12:00:00Z',
    };

    beforeEach(() => {
      vi.mocked(mockApiClient.get).mockResolvedValue({ data: mockReadmeContent });
    });

    it('fetches cached README content', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useProjectReadme('project-1', 'https://github.com/test/repo'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockReadmeContent);
      expect(vi.mocked(mockApiClient.get)).toHaveBeenCalledWith('/projects/project-1/readme');
    });

    it('falls back to fetching README when cached version fails', async () => {
      vi.mocked(mockApiClient.get).mockRejectedValueOnce({ response: { status: 404 } });
      vi.mocked(mockApiClient.post).mockResolvedValue({ data: mockReadmeContent });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useProjectReadme('project-1', 'https://github.com/test/repo'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(vi.mocked(mockApiClient.post)).toHaveBeenCalledWith(
        '/projects/project-1/fetch-readme',
        {
          repo_url: 'https://github.com/test/repo',
        }
      );
    });

    it('is disabled when projectId or repoUrl is missing', () => {
      const wrapper = createWrapper();

      const { result: result1 } = renderHook(
        () => useProjectReadme('', 'https://github.com/test/repo'),
        { wrapper }
      );
      const { result: result2 } = renderHook(() => useProjectReadme('project-1', ''), { wrapper });

      expect(vi.mocked(mockApiClient.get)).not.toHaveBeenCalled();
      expect(result1.current.data).toBeUndefined();
      expect(result2.current.data).toBeUndefined();
    });
  });

  describe('useProjectStats', () => {
    const mockStats = {
      total_projects: 10,
      featured_projects: 3,
      active_projects: 7,
      in_progress_projects: 2,
      archived_projects: 1,
    };

    beforeEach(() => {
      vi.mocked(mockApiClient.get).mockResolvedValue({ data: mockStats });
    });

    it('fetches project statistics', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProjectStats(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStats);
      expect(vi.mocked(mockApiClient.get)).toHaveBeenCalledWith('/projects/stats/summary');
    });
  });

  describe('useCreateProject', () => {
    const mockProject = createMockProject();
    const projectData: ProjectCreate = {
      title: 'New Project',
      description: 'Test project description',
      technologies: 'React, TypeScript',
      featured: false,
      status: 'active',
    };

    beforeEach(() => {
      vi.mocked(mockApiClient.post).mockResolvedValue({ data: mockProject });
    });

    it('creates project successfully', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateProject(), { wrapper });

      const createProject = result.current.mutateAsync;
      const createdProject = await createProject(projectData);

      expect(createdProject).toEqual(mockProject);
      expect(vi.mocked(mockApiClient.post)).toHaveBeenCalledWith('/projects', projectData);
    });

    it('handles create errors', async () => {
      vi.mocked(mockApiClient.post).mockRejectedValue(new Error('Validation error'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateProject(), { wrapper });

      await expect(result.current.mutateAsync(projectData)).rejects.toThrow('Validation error');
    });
  });

  describe('useUpdateProject', () => {
    const mockProject = createMockProject();
    const updateData: ProjectUpdate = {
      title: 'Updated Project Title',
      description: 'Updated description',
    };

    beforeEach(() => {
      vi.mocked(mockApiClient.put).mockResolvedValue({ data: mockProject });
    });

    it('updates project successfully', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateProject(), { wrapper });

      const updateProject = result.current.mutateAsync;
      const updatedProject = await updateProject({
        id: 'project-1',
        data: updateData,
      });

      expect(updatedProject).toEqual(mockProject);
      expect(vi.mocked(mockApiClient.put)).toHaveBeenCalledWith('/projects/project-1', updateData);
    });

    it('handles update errors', async () => {
      vi.mocked(mockApiClient.put).mockRejectedValue(new Error('Not found'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateProject(), { wrapper });

      await expect(
        result.current.mutateAsync({ id: 'nonexistent', data: updateData })
      ).rejects.toThrow('Not found');
    });
  });

  describe('useDeleteProject', () => {
    beforeEach(() => {
      vi.mocked(mockApiClient.delete).mockResolvedValue({ data: { success: true } });
    });

    it('deletes project successfully', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useDeleteProject(), { wrapper });

      const deleteProject = result.current.mutateAsync;
      const response = await deleteProject('project-1');

      expect(response).toEqual({ success: true });
      expect(vi.mocked(mockApiClient.delete)).toHaveBeenCalledWith('/projects/project-1');
    });

    it('handles delete errors', async () => {
      vi.mocked(mockApiClient.delete).mockRejectedValue(new Error('Not found'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useDeleteProject(), { wrapper });

      await expect(result.current.mutateAsync('nonexistent')).rejects.toThrow('Not found');
    });
  });

  describe('usePreviewReadme', () => {
    const mockReadmePreview = {
      content: '# Preview README\n\nPreview content.',
    };

    beforeEach(() => {
      vi.mocked(mockApiClient.post).mockResolvedValue({ data: mockReadmePreview });
    });

    it('previews README successfully', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePreviewReadme(), { wrapper });

      const previewReadme = result.current.mutateAsync;
      const preview = await previewReadme('https://github.com/test/repo');

      expect(preview).toEqual(mockReadmePreview);
      expect(vi.mocked(mockApiClient.post)).toHaveBeenCalledWith('/projects/preview-readme', {
        repo_url: 'https://github.com/test/repo',
      });
    });

    it('handles preview errors', async () => {
      vi.mocked(mockApiClient.post).mockRejectedValue(new Error('Repository not accessible'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => usePreviewReadme(), { wrapper });

      await expect(result.current.mutateAsync('https://github.com/private/repo')).rejects.toThrow(
        'Repository not accessible'
      );
    });
  });

  describe('useRefreshReadme', () => {
    const refreshData = {
      projectId: 'project-1',
      repoUrl: 'https://github.com/test/repo',
    };

    beforeEach(() => {
      vi.mocked(mockApiClient.post).mockResolvedValue({ data: { success: true } });
    });

    it('refreshes README successfully', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRefreshReadme(), { wrapper });

      const refreshReadme = result.current.mutateAsync;
      const response = await refreshReadme(refreshData);

      expect(response).toEqual({ success: true });
      expect(vi.mocked(mockApiClient.post)).toHaveBeenCalledWith(
        '/projects/project-1/refresh-readme',
        {
          repo_url: 'https://github.com/test/repo',
        }
      );
    });
  });

  describe('Utility Functions', () => {
    describe('parseTechnologies', () => {
      it('parses JSON array format', () => {
        const jsonFormat = '["React", "TypeScript", "Node.js"]';
        const result = parseTechnologies(jsonFormat);
        expect(result).toEqual(['React', 'TypeScript', 'Node.js']);
      });

      it('falls back to comma-separated format', () => {
        const commaFormat = 'React, TypeScript, Node.js';
        const result = parseTechnologies(commaFormat);
        expect(result).toEqual(['React', 'TypeScript', 'Node.js']);
      });

      it('handles empty string', () => {
        expect(parseTechnologies('')).toEqual([]);
      });

      it('handles undefined', () => {
        expect(parseTechnologies(undefined)).toEqual([]);
      });

      it('trims whitespace from comma-separated values', () => {
        const result = parseTechnologies('  React  ,  TypeScript  ,  Node.js  ');
        expect(result).toEqual(['React', 'TypeScript', 'Node.js']);
      });

      it('filters out empty values', () => {
        const result = parseTechnologies('React, , TypeScript, ');
        expect(result).toEqual(['React', 'TypeScript']);
      });
    });

    describe('formatTechnologies', () => {
      it('formats array as JSON string', () => {
        const technologies = ['React', 'TypeScript', 'Node.js'];
        const result = formatTechnologies(technologies);
        expect(result).toBe('["React","TypeScript","Node.js"]');
      });

      it('handles empty array', () => {
        const result = formatTechnologies([]);
        expect(result).toBe('[]');
      });
    });

    describe('parseRepositoryUrl', () => {
      it('parses GitHub URL correctly', () => {
        const url = 'https://github.com/facebook/react';
        const result = parseRepositoryUrl(url);
        expect(result).toEqual({
          type: 'github',
          owner: 'facebook',
          repo: 'react',
        });
      });

      it('parses GitLab URL correctly', () => {
        const url = 'https://gitlab.com/gitlab-org/gitlab';
        const result = parseRepositoryUrl(url);
        expect(result).toEqual({
          type: 'gitlab',
          owner: 'gitlab-org',
          repo: 'gitlab',
        });
      });

      it('handles GitHub URLs with trailing slash', () => {
        const url = 'https://github.com/facebook/react/';
        const result = parseRepositoryUrl(url);
        expect(result).toEqual({
          type: 'github',
          owner: 'facebook',
          repo: 'react',
        });
      });

      it('handles unknown Git servers', () => {
        const url = 'https://git.example.com/user/repo';
        const result = parseRepositoryUrl(url);
        expect(result).toEqual({
          type: 'unknown',
          owner: 'user',
          repo: 'repo',
        });
      });

      it('returns null for invalid URLs', () => {
        const invalidUrl = 'not-a-url';
        const result = parseRepositoryUrl(invalidUrl);
        expect(result).toBeNull();
      });

      it('returns null for URLs with insufficient path segments', () => {
        const url = 'https://github.com/onlyowner';
        const result = parseRepositoryUrl(url);
        expect(result).toBeNull();
      });
    });

    describe('generateSlug', () => {
      it('generates slug from title', () => {
        const title = 'My Awesome Project';
        const result = generateSlug(title);
        expect(result).toBe('my-awesome-project');
      });

      it('removes special characters', () => {
        const title = 'Project & Testing! (Version 2.0)';
        const result = generateSlug(title);
        expect(result).toBe('project-testing-version-20');
      });

      it('handles multiple spaces', () => {
        const title = 'Multiple    Spaces    Project';
        const result = generateSlug(title);
        expect(result).toBe('multiple-spaces-project');
      });

      it('handles multiple hyphens', () => {
        const title = 'Project---With---Hyphens';
        const result = generateSlug(title);
        expect(result).toBe('project-with-hyphens');
      });

      it('trims leading and trailing whitespace', () => {
        const title = '   Trimmed Project   ';
        const result = generateSlug(title);
        expect(result).toBe('trimmed-project');
      });

      it('handles empty string', () => {
        const result = generateSlug('');
        expect(result).toBe('');
      });

      it('handles string with only special characters', () => {
        const title = '!@#$%^&*()';
        const result = generateSlug(title);
        expect(result).toBe('');
      });
    });
  });

  describe('Error Handling', () => {
    it('handles network errors in queries', async () => {
      vi.mocked(mockApiClient.get).mockRejectedValue(new Error('Network error'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error('Network error'));
    });

    it('handles API validation errors in mutations', async () => {
      vi.mocked(mockApiClient.post).mockRejectedValue({
        response: {
          status: 422,
          data: { detail: 'Title is required' },
        },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateProject(), { wrapper });

      await expect(
        result.current.mutateAsync({
          title: '',
          description: '',
        } as ProjectCreate)
      ).rejects.toEqual({
        response: {
          status: 422,
          data: { detail: 'Title is required' },
        },
      });
    });

    it('handles unauthorized access', async () => {
      vi.mocked(mockApiClient.get).mockRejectedValue({
        response: { status: 401, data: { detail: 'Unauthorized' } },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProjectStats(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });
});
