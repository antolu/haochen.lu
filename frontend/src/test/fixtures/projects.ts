/**
 * Test fixtures and factories for project testing
 */
import { Project } from '../../hooks/useProjects';

export const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'test-project-1',
  title: 'Test Project',
  slug: 'test-project',
  description: 'A test project for unit testing',
  short_description: 'Short test description',
  github_url: 'https://github.com/test/project',
  demo_url: 'https://demo.test-project.com',
  image_url: 'https://example.com/image.jpg',
  technologies: 'React, TypeScript, Node.js',
  featured: false,
  status: 'active',
  repository_type: 'github',
  repository_owner: 'test',
  repository_name: 'project',
  use_readme: false,
  readme_content: null,
  readme_last_updated: null,
  created_at: '2023-01-15T10:00:00Z',
  updated_at: '2023-01-15T10:00:00Z',
  ...overrides,
});

export const mockProjects: Project[] = [
  createMockProject({
    id: 'project-1',
    title: 'Active React Project',
    slug: 'active-react-project',
    status: 'active',
    featured: true,
    technologies: 'React, TypeScript, Tailwind CSS',
  }),
  createMockProject({
    id: 'project-2',
    title: 'In Progress Vue App',
    slug: 'in-progress-vue-app',
    status: 'in_progress',
    featured: false,
    technologies: 'Vue.js, JavaScript, CSS',
    github_url: 'https://github.com/test/vue-app',
    demo_url: null,
  }),
  createMockProject({
    id: 'project-3',
    title: 'Archived Legacy Project',
    slug: 'archived-legacy-project',
    status: 'archived',
    featured: false,
    technologies: 'jQuery, PHP, MySQL',
    github_url: null,
    demo_url: null,
    image_url: null,
  }),
  createMockProject({
    id: 'project-4',
    title: 'GitLab Integration Project',
    slug: 'gitlab-integration-project',
    status: 'active',
    repository_type: 'gitlab',
    repository_owner: 'gitlab-test',
    repository_name: 'integration-project',
    github_url: 'https://gitlab.com/gitlab-test/integration-project',
    use_readme: true,
    readme_content: '# GitLab Project\n\nThis is a test GitLab project.',
    readme_last_updated: '2023-01-20T14:30:00Z',
  }),
];

export const mockProjectsListResponse = {
  projects: mockProjects,
  total: mockProjects.length,
};

export const mockProjectStats = {
  total_projects: 4,
  featured_projects: 1,
  active_projects: 2,
  in_progress_projects: 1,
  archived_projects: 1,
};

export const mockReadmeResponse = {
  content:
    '# Test Project\n\nThis is a test README file with **markdown** content.\n\n## Features\n\n- Feature 1\n- Feature 2\n\n```javascript\nconsole.log("Hello World");\n```',
  source: 'github',
  last_updated: '2023-01-15T12:00:00Z',
};
