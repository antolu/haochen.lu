import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import MDEditor from '@uiw/react-md-editor';
import { motion } from 'framer-motion';
import RepositoryConnector from './RepositoryConnector';
import TagMultiSelect from './admin/TagMultiSelect';
import type { Project, ProjectCreate, ProjectUpdate } from '../hooks/useProjects';
import {
  useCreateProject,
  useUpdateProject,
  usePreviewReadme,
  parseTechnologies,
  formatTechnologies,
  generateSlug,
} from '../hooks/useProjects';
import { useProjectTechnologies } from '../hooks/useProjects';

interface ProjectFormProps {
  project?: Project;
  onSuccess?: (project: Project) => void;
  onCancel?: () => void;
}

interface FormData {
  title: string;
  slug: string;
  description: string;
  short_description: string;
  github_url: string;
  demo_url: string;
  image_url: string;
  technologies: string;
  featured: boolean;
  status: 'active' | 'archived' | 'in_progress';
  use_readme: boolean;
  repository_type?: string;
  repository_owner?: string;
  repository_name?: string;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ project, onSuccess, onCancel }) => {
  const isEditing = !!project;
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const previewReadmeMutation = usePreviewReadme();

  const [technologiesInput, setTechnologiesInput] = useState('');
  const [markdownContent, setMarkdownContent] = useState('');
  const [useReadme, setUseReadme] = useState(false);
  const [readmePreview, setReadmePreview] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const { data: distinctTechnologies = [] } = useProjectTechnologies();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    reset,
  } = useForm<FormData>({
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      short_description: '',
      github_url: '',
      demo_url: '',
      image_url: '',
      technologies: '',
      featured: false,
      status: 'active',
      use_readme: false,
      repository_type: undefined,
      repository_owner: undefined,
      repository_name: undefined,
    },
  });

  // Initialize form with project data
  useEffect(() => {
    if (project) {
      const technologies = parseTechnologies(project.technologies);
      setTechnologiesInput(technologies.join(', '));
      setMarkdownContent(project.description);
      setUseReadme(project.use_readme || false);

      reset({
        title: project.title,
        slug: project.slug,
        description: project.description,
        short_description: project.short_description || '',
        github_url: project.github_url || '',
        demo_url: project.demo_url || '',
        image_url: project.image_url || '',
        technologies: technologies.join(', '),
        featured: project.featured,
        status: project.status,
        use_readme: project.use_readme || false,
        repository_type: project.repository_type || undefined,
        repository_owner: project.repository_owner || undefined,
        repository_name: project.repository_name || undefined,
      });
    }
  }, [project, reset]);

  // Watch fields for dynamic updates
  const watchedTitle = watch('title');
  const watchedGithubUrl = watch('github_url');

  // Auto-generate slug from title
  useEffect(() => {
    if (watchedTitle && !isEditing) {
      setValue('slug', generateSlug(watchedTitle));
    }
  }, [watchedTitle, setValue, isEditing]);

  // Handle repository connector changes
  const handleRepositoryChange = (repoData: {
    url: string;
    type?: string;
    owner?: string;
    name?: string;
  }) => {
    setValue('github_url', repoData.url);
    setValue('repository_type', repoData.type);
    setValue('repository_owner', repoData.owner);
    setValue('repository_name', repoData.name);
  };

  // Handle technologies input
  const handleTechnologiesChange = (value: string) => {
    setTechnologiesInput(value);
    setValue('technologies', value);
  };

  // Preview README
  const handlePreviewReadme = async () => {
    if (!watchedGithubUrl) return;

    setIsLoadingPreview(true);
    try {
      const result = await previewReadmeMutation.mutateAsync(watchedGithubUrl);
      setReadmePreview(result.content);
      setMarkdownContent(result.content);
    } catch (error) {
      console.error('Failed to preview README:', error);
      setReadmePreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    try {
      const technologies = data.technologies
        .split(',')
        .map(tech => tech.trim())
        .filter(Boolean);

      const projectData = {
        title: data.title,
        slug: isEditing ? undefined : data.slug,
        description: useReadme && readmePreview ? readmePreview : markdownContent,
        short_description: data.short_description || undefined,
        github_url: data.github_url || undefined,
        demo_url: data.demo_url || undefined,
        image_url: data.image_url || undefined,
        technologies: formatTechnologies(technologies),
        featured: data.featured,
        status: data.status,
        use_readme: data.use_readme,
        repository_type: data.repository_type,
        repository_owner: data.repository_owner,
        repository_name: data.repository_name,
      };

      let result: Project;
      if (isEditing) {
        result = await updateMutation.mutateAsync({
          id: project.id,
          data: projectData as ProjectUpdate,
        });
      } else {
        result = await createMutation.mutateAsync(projectData as ProjectCreate);
      }

      onSuccess?.(result);
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  const isLoading = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <motion.div
      className="max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit Project' : 'Create New Project'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {isEditing
                ? 'Update project information and content'
                : 'Add a new project to your portfolio'}
            </p>
          </div>
          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Saving...' : isEditing ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Title *
              </label>
              <input
                {...register('title', { required: 'Title is required' })}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter project title"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Slug {!isEditing && '*'}
              </label>
              <input
                {...register('slug', { required: !isEditing ? 'Slug is required' : false })}
                type="text"
                disabled={isEditing}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="project-url-slug"
              />
              {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>}
              <p className="mt-1 text-xs text-gray-500">
                {isEditing ? 'Slug cannot be changed after creation' : 'Auto-generated from title'}
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                {...register('status')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="in_progress">In Progress</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Short Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Short Description
              </label>
              <input
                {...register('short_description')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description for project cards"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Used in project cards and meta descriptions
              </p>
            </div>

            {/* Technologies */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Technologies</label>
              <TagMultiSelect
                value={technologiesInput
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean)}
                options={distinctTechnologies}
                onChange={vals => handleTechnologiesChange(vals.join(', '))}
                placeholder="Search or create technologies..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Type to search or press Enter to create a new technology
              </p>
            </div>

            {/* Featured */}
            <div className="md:col-span-2">
              <label className="flex items-center">
                <input
                  {...register('featured')}
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Mark as featured project</span>
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Featured projects appear on the homepage and in special sections
              </p>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Links & Resources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GitHub URL */}
            <div className="md:col-span-2">
              <RepositoryConnector
                value={watch('github_url')}
                onChange={handleRepositoryChange}
                disabled={isSubmitting}
              />
            </div>

            {/* Demo URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Demo URL</label>
              <input
                {...register('demo_url')}
                type="url"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://project-demo.com"
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Image URL
              </label>
              <input
                {...register('image_url')}
                type="url"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
        </div>

        {/* Content Source */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Project Description</h3>

          {/* README Integration */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center">
                <input
                  {...register('use_readme')}
                  type="checkbox"
                  checked={useReadme}
                  onChange={e => setUseReadme(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Use README.md from repository
                </span>
              </label>

              {watchedGithubUrl && (
                <button
                  type="button"
                  onClick={handlePreviewReadme}
                  disabled={isLoadingPreview || !watchedGithubUrl}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {isLoadingPreview ? 'Loading...' : 'Preview README'}
                </button>
              )}
            </div>

            {readmePreview && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">README Preview</span>
                  <button
                    type="button"
                    onClick={() => setReadmePreview(null)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="text-sm text-blue-700 max-h-32 overflow-y-auto">
                  {readmePreview.substring(0, 300)}...
                </div>
              </div>
            )}
          </div>

          {/* Markdown Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {useReadme ? 'Custom Description (overrides README)' : 'Project Description *'}
            </label>
            <div data-color-mode="light">
              <MDEditor
                value={markdownContent}
                onChange={val => setMarkdownContent(val || '')}
                preview="edit"
                height={400}
                visibleDragbar={false}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {useReadme
                ? 'Leave empty to use README content, or add custom description to override'
                : 'Supports Markdown formatting including code blocks, links, and images'}
            </p>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isLoading && (
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="opacity-25"
                />
                <path
                  fill="currentColor"
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {isLoading ? 'Saving...' : isEditing ? 'Update Project' : 'Create Project'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default ProjectForm;
