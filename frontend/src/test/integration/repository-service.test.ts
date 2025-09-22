/**
 * Repository Service Integration Tests
 *
 * Integration tests for repository-related services including:
 * - Repository validation and metadata extraction
 * - README content fetching and parsing
 * - GitHub/GitLab API integration
 * - Repository URL parsing and validation
 * - Error handling for private/missing repositories
 * - Content caching and refresh mechanisms
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import apiClient from '../../api/client';
import {
  parseRepositoryUrl,
  generateSlug,
  parseTechnologies,
  formatTechnologies,
} from '../../hooks/useProjects';

// Mock adapter for API calls
let mockAdapter: MockAdapter;

// Mock repository responses
/* const mockGitHubRepo = {
  id: 123456,
  name: 'test-project',
  full_name: 'testuser/test-project',
  description: 'A test project for integration testing',
  html_url: 'https://github.com/testuser/test-project',
  clone_url: 'https://github.com/testuser/test-project.git',
  ssh_url: 'git@github.com:testuser/test-project.git',
  default_branch: 'main',
  language: 'TypeScript',
  languages_url: 'https://api.github.com/repos/testuser/test-project/languages',
  private: false,
  fork: false,
  archived: false,
  disabled: false,
  created_at: '2023-01-15T10:00:00Z',
  updated_at: '2023-01-20T15:30:00Z',
  pushed_at: '2023-01-25T09:15:00Z',
  size: 1024,
  stargazers_count: 42,
  watchers_count: 12,
  forks_count: 8,
  open_issues_count: 3,
  topics: ['react', 'typescript', 'web-development'],
  license: {
    key: 'mit',
    name: 'MIT License',
    spdx_id: 'MIT',
    url: 'https://api.github.com/licenses/mit',
  },
}; */

/* const mockGitLabProject = {
  id: 789012,
  name: 'test-project',
  path: 'test-project',
  path_with_namespace: 'testuser/test-project',
  description: 'A GitLab test project',
  web_url: 'https://gitlab.com/testuser/test-project',
  http_url_to_repo: 'https://gitlab.com/testuser/test-project.git',
  ssh_url_to_repo: 'git@gitlab.com:testuser/test-project.git',
  default_branch: 'main',
  visibility: 'public',
  archived: false,
  created_at: '2023-01-15T10:00:00Z',
  last_activity_at: '2023-01-25T09:15:00Z',
  star_count: 24,
  forks_count: 5,
  open_issues_count: 2,
  tag_list: ['vue', 'javascript', 'frontend'],
}; */

const mockReadmeContent = `# Test Project

This is a comprehensive test project demonstrating various features.

## Features

- Feature 1: Authentication system
- Feature 2: Data visualization
- Feature 3: Real-time updates

## Installation

\`\`\`bash
npm install
npm run dev
\`\`\`

## Usage

\`\`\`javascript
import { TestProject } from './test-project';

const app = new TestProject();
app.start();
\`\`\`

## Contributing

Please read our contributing guidelines before submitting PRs.

## License

This project is licensed under the MIT License.
`;

describe('Repository Service Integration Tests', () => {
  beforeEach(() => {
    mockAdapter = new MockAdapter(apiClient);
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockAdapter.restore();
  });

  describe('Repository Validation Service', () => {
    it('validates GitHub repository successfully', async () => {
      const repoUrl = 'https://github.com/testuser/test-project';
      const expectedResponse = {
        type: 'github',
        owner: 'testuser',
        name: 'test-project',
        url: repoUrl,
        valid: true,
      };

      mockAdapter.onPost('/projects/repository/validate').reply(200, expectedResponse);

      const response = await apiClient.post('/projects/repository/validate', {
        repository_url: repoUrl,
      });

      expect(response.data).toEqual(expectedResponse);
      expect(mockAdapter.history.post[0].data).toBe(JSON.stringify({ repository_url: repoUrl }));
    });

    it('validates GitLab repository successfully', async () => {
      const repoUrl = 'https://gitlab.com/testuser/test-project';
      const expectedResponse = {
        type: 'gitlab',
        owner: 'testuser',
        name: 'test-project',
        url: repoUrl,
        valid: true,
      };

      mockAdapter.onPost('/projects/repository/validate').reply(200, expectedResponse);

      const response = await apiClient.post('/projects/repository/validate', {
        repository_url: repoUrl,
      });

      expect(response.data).toEqual(expectedResponse);
    });

    it('handles private repository validation', async () => {
      const repoUrl = 'https://github.com/testuser/private-project';

      mockAdapter.onPost('/projects/repository/validate').reply(403, {
        detail: 'Repository is private or does not exist',
      });

      await expect(
        apiClient.post('/projects/repository/validate', {
          repository_url: repoUrl,
        })
      ).rejects.toMatchObject({
        response: {
          status: 403,
          data: { detail: 'Repository is private or does not exist' },
        },
      });
    });

    it('handles invalid repository URLs', async () => {
      const invalidUrl = 'not-a-repository-url';

      mockAdapter.onPost('/projects/repository/validate').reply(400, {
        detail: 'Invalid repository URL format',
      });

      await expect(
        apiClient.post('/projects/repository/validate', {
          repository_url: invalidUrl,
        })
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: { detail: 'Invalid repository URL format' },
        },
      });
    });

    it('handles repository not found errors', async () => {
      const nonExistentUrl = 'https://github.com/nonexistent/repository';

      mockAdapter.onPost('/projects/repository/validate').reply(404, {
        detail: 'Repository not found',
      });

      await expect(
        apiClient.post('/projects/repository/validate', {
          repository_url: nonExistentUrl,
        })
      ).rejects.toMatchObject({
        response: {
          status: 404,
          data: { detail: 'Repository not found' },
        },
      });
    });

    it('handles rate limiting from Git providers', async () => {
      const repoUrl = 'https://github.com/testuser/test-project';

      mockAdapter.onPost('/projects/repository/validate').reply(429, {
        detail: 'Rate limit exceeded',
        retry_after: 3600,
      });

      await expect(
        apiClient.post('/projects/repository/validate', {
          repository_url: repoUrl,
        })
      ).rejects.toMatchObject({
        response: {
          status: 429,
          data: { detail: 'Rate limit exceeded', retry_after: 3600 },
        },
      });
    });
  });

  describe('README Content Service', () => {
    it('fetches README content from GitHub', async () => {
      const projectId = 'project-1';
      const repoUrl = 'https://github.com/testuser/test-project';
      const expectedResponse = {
        content: mockReadmeContent,
        source: 'github',
        last_updated: '2023-01-25T09:15:00Z',
      };

      mockAdapter.onPost(`/projects/${projectId}/fetch-readme`).reply(200, expectedResponse);

      const response = await apiClient.post(`/projects/${projectId}/fetch-readme`, {
        repo_url: repoUrl,
      });

      expect(response.data).toEqual(expectedResponse);
      expect((response.data as { content: string }).content).toContain('# Test Project');
      expect((response.data as { content: string }).content).toContain('## Features');
    });

    it('fetches README content from GitLab', async () => {
      const projectId = 'project-1';
      const repoUrl = 'https://gitlab.com/testuser/test-project';
      const expectedResponse = {
        content: mockReadmeContent,
        source: 'gitlab',
        last_updated: '2023-01-25T09:15:00Z',
      };

      mockAdapter.onPost(`/projects/${projectId}/fetch-readme`).reply(200, expectedResponse);

      const response = await apiClient.post(`/projects/${projectId}/fetch-readme`, {
        repo_url: repoUrl,
      });

      expect(response.data).toEqual(expectedResponse);
      expect((response.data as { source: string }).source).toBe('gitlab');
    });

    it('handles README not found in repository', async () => {
      const projectId = 'project-1';
      const repoUrl = 'https://github.com/testuser/no-readme-project';

      mockAdapter.onPost(`/projects/${projectId}/fetch-readme`).reply(404, {
        detail: 'README.md not found in repository',
      });

      await expect(
        apiClient.post(`/projects/${projectId}/fetch-readme`, {
          repo_url: repoUrl,
        })
      ).rejects.toMatchObject({
        response: {
          status: 404,
          data: { detail: 'README.md not found in repository' },
        },
      });
    });

    it('retrieves cached README content', async () => {
      const projectId = 'project-1';
      const cachedResponse = {
        content: mockReadmeContent,
        source: 'github',
        last_updated: '2023-01-20T10:00:00Z',
        cached: true,
      };

      mockAdapter.onGet(`/projects/${projectId}/readme`).reply(200, cachedResponse);

      const response = await apiClient.get(`/projects/${projectId}/readme`);

      expect(response.data).toEqual(cachedResponse);
      expect((response.data as { cached: boolean }).cached).toBe(true);
    });

    it('refreshes README content when requested', async () => {
      const projectId = 'project-1';
      const repoUrl = 'https://github.com/testuser/test-project';
      const refreshedResponse = {
        content: `${mockReadmeContent}\n\n## Updates\n\nNew content added.`,
        source: 'github',
        last_updated: '2023-01-25T15:30:00Z',
        refreshed: true,
      };

      mockAdapter.onPost(`/projects/${projectId}/refresh-readme`).reply(200, refreshedResponse);

      const response = await apiClient.post(`/projects/${projectId}/refresh-readme`, {
        repo_url: repoUrl,
      });

      expect(response.data).toEqual(refreshedResponse);
      expect((response.data as { content: string }).content).toContain('## Updates');
    });

    it('handles README parsing errors', async () => {
      const projectId = 'project-1';
      const repoUrl = 'https://github.com/testuser/malformed-readme';

      mockAdapter.onPost(`/projects/${projectId}/fetch-readme`).reply(422, {
        detail: 'Unable to parse README content',
      });

      await expect(
        apiClient.post(`/projects/${projectId}/fetch-readme`, {
          repo_url: repoUrl,
        })
      ).rejects.toMatchObject({
        response: {
          status: 422,
          data: { detail: 'Unable to parse README content' },
        },
      });
    });
  });

  describe('README Preview Service', () => {
    it('previews README without saving to project', async () => {
      const repoUrl = 'https://github.com/testuser/preview-project';
      const previewResponse = {
        content: mockReadmeContent,
        source: 'github',
        preview: true,
      };

      mockAdapter.onPost('/projects/preview-readme').reply(200, previewResponse);

      const response = await apiClient.post('/projects/preview-readme', {
        repo_url: repoUrl,
      });

      expect(response.data).toEqual(previewResponse);
      expect((response.data as { preview: boolean }).preview).toBe(true);
    });

    it('handles preview for different README formats', async () => {
      const repoUrl = 'https://github.com/testuser/rst-readme';
      const rstReadme = `Test Project
============

This is a reStructuredText README file.

Features
--------

* Feature 1
* Feature 2
* Feature 3

Installation
------------

.. code-block:: bash

   pip install test-project
`;

      const previewResponse = {
        content: rstReadme,
        source: 'github',
        format: 'rst',
        preview: true,
      };

      mockAdapter.onPost('/projects/preview-readme').reply(200, previewResponse);

      const response = await apiClient.post('/projects/preview-readme', {
        repo_url: repoUrl,
      });

      expect(response.data).toEqual(previewResponse);
      expect((response.data as { format: string }).format).toBe('rst');
    });

    it('handles preview timeouts gracefully', async () => {
      const repoUrl = 'https://github.com/testuser/slow-repo';

      mockAdapter.onPost('/projects/preview-readme').timeout();

      await expect(
        apiClient.post('/projects/preview-readme', {
          repo_url: repoUrl,
        })
      ).rejects.toMatchObject({
        code: 'ECONNABORTED',
      });
    });
  });

  describe('Repository URL Parsing Utilities', () => {
    it('parses GitHub URLs correctly', () => {
      const testCases = [
        {
          url: 'https://github.com/facebook/react',
          expected: { type: 'github', owner: 'facebook', repo: 'react' },
        },
        {
          url: 'https://github.com/microsoft/vscode/',
          expected: { type: 'github', owner: 'microsoft', repo: 'vscode' },
        },
        {
          url: 'http://github.com/nodejs/node',
          expected: { type: 'github', owner: 'nodejs', repo: 'node' },
        },
      ];

      testCases.forEach(({ url, expected }) => {
        const result = parseRepositoryUrl(url);
        expect(result).toEqual(expected);
      });
    });

    it('parses GitLab URLs correctly', () => {
      const testCases = [
        {
          url: 'https://gitlab.com/gitlab-org/gitlab',
          expected: { type: 'gitlab', owner: 'gitlab-org', repo: 'gitlab' },
        },
        {
          url: 'https://gitlab.com/fdroid/fdroidclient/',
          expected: { type: 'gitlab', owner: 'fdroid', repo: 'fdroidclient' },
        },
      ];

      testCases.forEach(({ url, expected }) => {
        const result = parseRepositoryUrl(url);
        expect(result).toEqual(expected);
      });
    });

    it('parses custom Git server URLs', () => {
      const testCases = [
        {
          url: 'https://git.example.com/user/project',
          expected: { type: 'unknown', owner: 'user', repo: 'project' },
        },
        {
          url: 'https://source.company.com/team/application',
          expected: { type: 'unknown', owner: 'team', repo: 'application' },
        },
      ];

      testCases.forEach(({ url, expected }) => {
        const result = parseRepositoryUrl(url);
        expect(result).toEqual(expected);
      });
    });

    it('handles invalid URLs gracefully', () => {
      const invalidUrls = [
        'not-a-url',
        'https://example.com',
        'https://github.com',
        'https://github.com/user',
        'ftp://github.com/user/repo',
        '',
        null,
        undefined,
      ];

      invalidUrls.forEach(url => {
        const result = parseRepositoryUrl(url as string);
        expect(result).toBeNull();
      });
    });

    it('handles edge cases in URL parsing', () => {
      const edgeCases = [
        {
          url: 'https://github.com/user/repo/tree/main',
          expected: { type: 'github', owner: 'user', repo: 'repo' },
        },
        {
          url: 'https://github.com/user/repo.git',
          expected: { type: 'github', owner: 'user', repo: 'repo.git' },
        },
        {
          url: 'https://github.com/user-name/repo-name',
          expected: { type: 'github', owner: 'user-name', repo: 'repo-name' },
        },
      ];

      edgeCases.forEach(({ url, expected }) => {
        const result = parseRepositoryUrl(url);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('Content Processing Utilities', () => {
    it('generates slugs from project titles', () => {
      const testCases = [
        {
          title: 'My Awesome Project',
          expected: 'my-awesome-project',
        },
        {
          title: 'React + TypeScript Starter',
          expected: 'react-typescript-starter',
        },
        {
          title: 'Project with (Special) Characters!',
          expected: 'project-with-special-characters',
        },
        {
          title: '   Multiple   Spaces   Project   ',
          expected: 'multiple-spaces-project',
        },
        {
          title: 'UPPERCASE PROJECT NAME',
          expected: 'uppercase-project-name',
        },
        {
          title: '',
          expected: '',
        },
      ];

      testCases.forEach(({ title, expected }) => {
        const result = generateSlug(title);
        expect(result).toBe(expected);
      });
    });

    it('parses technology strings correctly', () => {
      const testCases = [
        {
          input: '["React", "TypeScript", "Node.js"]',
          expected: ['React', 'TypeScript', 'Node.js'],
        },
        {
          input: 'React, TypeScript, Node.js',
          expected: ['React', 'TypeScript', 'Node.js'],
        },
        {
          input: '  React  ,  TypeScript  ,  Node.js  ',
          expected: ['React', 'TypeScript', 'Node.js'],
        },
        {
          input: 'Single Technology',
          expected: ['Single Technology'],
        },
        {
          input: '',
          expected: [],
        },
        {
          input: undefined,
          expected: [],
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseTechnologies(input);
        expect(result).toEqual(expected);
      });
    });

    it('formats technology arrays correctly', () => {
      const testCases = [
        {
          input: ['React', 'TypeScript', 'Node.js'],
          expected: '["React","TypeScript","Node.js"]',
        },
        {
          input: ['Single Tech'],
          expected: '["Single Tech"]',
        },
        {
          input: [],
          expected: '[]',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = formatTechnologies(input);
        expect(result).toBe(expected);
      });
    });

    it('handles technology parsing edge cases', () => {
      const edgeCases = [
        {
          input: 'React, , TypeScript, ',
          expected: ['React', 'TypeScript'],
        },
        {
          input: '["React", "TypeScript"',
          expected: ['["React"', '"TypeScript"'],
        },
        {
          input: 'React,,TypeScript',
          expected: ['React', 'TypeScript'],
        },
      ];

      edgeCases.forEach(({ input, expected }) => {
        const result = parseTechnologies(input);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('handles intermittent network failures', async () => {
      const repoUrl = 'https://github.com/testuser/flaky-repo';

      // First request fails
      mockAdapter.onPost('/projects/repository/validate').replyOnce(500, {
        detail: 'Internal server error',
      });

      // Second request succeeds
      mockAdapter.onPost('/projects/repository/validate').reply(200, {
        type: 'github',
        owner: 'testuser',
        name: 'flaky-repo',
        url: repoUrl,
        valid: true,
      });

      // First attempt should fail
      await expect(
        apiClient.post('/projects/repository/validate', {
          repository_url: repoUrl,
        })
      ).rejects.toMatchObject({
        response: { status: 500 },
      });

      // Second attempt should succeed
      const response = await apiClient.post('/projects/repository/validate', {
        repository_url: repoUrl,
      });

      expect(response.status).toBe(200);
      expect((response.data as { valid: boolean }).valid).toBe(true);
    });

    it('handles partial service degradation gracefully', async () => {
      const projectId = 'project-1';

      // README service is down but validation works
      mockAdapter.onGet(`/projects/${projectId}/readme`).reply(503, {
        detail: 'README service temporarily unavailable',
      });

      mockAdapter.onPost('/projects/repository/validate').reply(200, {
        type: 'github',
        owner: 'testuser',
        name: 'test-project',
        url: 'https://github.com/testuser/test-project',
        valid: true,
      });

      // Validation should still work
      const validateResponse = await apiClient.post('/projects/repository/validate', {
        repository_url: 'https://github.com/testuser/test-project',
      });
      expect(validateResponse.status).toBe(200);

      // README should fail gracefully
      await expect(apiClient.get(`/projects/${projectId}/readme`)).rejects.toMatchObject({
        response: { status: 503 },
      });
    });

    it('handles malformed service responses', async () => {
      const repoUrl = 'https://github.com/testuser/bad-response';

      mockAdapter.onPost('/projects/repository/validate').reply(200, 'not-json', {
        'content-type': 'application/json',
      });

      const resp = await apiClient.post('/projects/repository/validate', {
        repository_url: repoUrl,
      });
      expect(resp.data).toBe('not-json');
    });

    it('handles service timeouts with appropriate messages', async () => {
      const repoUrl = 'https://github.com/testuser/timeout-repo';

      mockAdapter.onPost('/projects/repository/validate').timeout();

      await expect(
        apiClient.post('/projects/repository/validate', {
          repository_url: repoUrl,
        })
      ).rejects.toMatchObject({
        code: 'ECONNABORTED',
        message: expect.stringContaining('timeout') as string,
      });
    });
  });
});
