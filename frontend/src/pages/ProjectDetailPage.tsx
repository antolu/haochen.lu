import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProject, useProjectReadme, parseTechnologies } from '../hooks/useProjects';
type ProjectReadmeResponse = { content?: string; last_updated?: string; source?: string };
import MarkdownRenderer from '../components/MarkdownRenderer';
import { formatDate } from '../utils/dateFormat';

const ProjectDetailPage: React.FC = () => {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data: project, isLoading, error } = useProject(slug ?? '');
  const { data: readme } = useProjectReadme(
    project?.id ?? '',
    project?.use_readme ? project?.github_url : undefined
  );

  if (isLoading) {
    return <ProjectDetailSkeleton />;
  }

  if (error || !project) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-12 h-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Project not found</h3>
            <p className="text-gray-500 mb-4">
              The project you're looking for doesn't exist or has been removed.
            </p>
            <Link
              to="/projects"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              ← Back to Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const technologies = parseTechnologies(project.technologies);
  const content = (readme as ProjectReadmeResponse | undefined)?.content ?? project.description;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'in_progress':
        return 'In Progress';
      case 'archived':
        return 'Archived';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            to="/projects"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Projects
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Project Image */}
            <div className="lg:col-span-2">
              <motion.div
                className="aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-lg"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
              >
                {project.image_url ? (
                  <img
                    src={project.image_url}
                    alt={project.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                    <svg
                      className="w-24 h-24 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Project Meta */}
            <div className="lg:col-span-1">
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {/* Title and Status */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(project.status)}`}
                    >
                      {getStatusText(project.status)}
                    </span>
                    {project.featured && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        ⭐ Featured
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
                  {project.short_description && (
                    <p className="text-lg text-gray-600 mt-2">{project.short_description}</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  {project.demo_url && (
                    <a
                      href={project.demo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      View Live Demo
                    </a>
                  )}

                  {project.github_url && (
                    <a
                      href={project.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                      </svg>
                      View Source Code
                    </a>
                  )}
                </div>

                {/* Technologies */}
                {technologies.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Technologies Used</h3>
                    <div className="flex flex-wrap gap-2">
                      {technologies.map((tech, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Project Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Project Info</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Created</dt>
                      <dd className="text-gray-900">{formatDate(project.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Last Updated</dt>
                      <dd className="text-gray-900">{formatDate(project.updated_at)}</dd>
                    </div>
                    {(readme as ProjectReadmeResponse | undefined)?.last_updated && (
                      <div>
                        <dt className="text-gray-500">README Updated</dt>
                        <dd className="text-gray-900">
                          {formatDate((readme as ProjectReadmeResponse).last_updated as string)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="bg-white rounded-xl shadow-sm p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {(readme as ProjectReadmeResponse | undefined)?.source && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-blue-600 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm text-blue-800">
                    This content is automatically synced from the project's README.md file on{' '}
                    {(readme as ProjectReadmeResponse).source}.
                  </span>
                </div>
              </div>
            )}

            <MarkdownRenderer content={content} />
          </motion.div>
        </div>
      </section>
    </div>
  );
};

// Loading skeleton component
const ProjectDetailSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Navigation Skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>

      {/* Hero Section Skeleton */}
      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Image Skeleton */}
            <div className="lg:col-span-2">
              <div className="aspect-video bg-gray-200 rounded-xl animate-pulse"></div>
            </div>

            {/* Meta Skeleton */}
            <div className="lg:col-span-1 space-y-6">
              <div>
                <div className="flex gap-2 mb-2">
                  <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
                <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-5 w-full bg-gray-200 rounded animate-pulse"></div>
              </div>

              <div className="space-y-3">
                <div className="h-12 w-full bg-gray-200 rounded-lg animate-pulse"></div>
                <div className="h-12 w-full bg-gray-200 rounded-lg animate-pulse"></div>
              </div>

              <div>
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-3"></div>
                <div className="flex flex-wrap gap-2">
                  <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="h-6 w-14 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Skeleton */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="space-y-4">
              <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-4/5 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-32 w-full bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProjectDetailPage;
