import React, { memo } from "react";
import { Link } from "react-router-dom";
import { parseTechnologies, type Project } from "../hooks/useProjects";

interface ProjectCardProps {
  project: Project;
  className?: string;
}

const ProjectCard: React.FC<ProjectCardProps> = memo(
  ({ project, className = "" }) => {
    const technologies = parseTechnologies(project.technologies);

    const getStatusColor = (status: string) => {
      switch (status) {
        case "active":
          return "bg-green-100 text-green-800";
        case "in_progress":
          return "bg-yellow-100 text-yellow-800";
        case "archived":
          return "bg-gray-100 text-gray-800";
        default:
          return "bg-gray-100 text-gray-800";
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case "active":
          return "Active";
        case "in_progress":
          return "In Progress";
        case "archived":
          return "Archived";
        default:
          return "Unknown";
      }
    };

    return (
      <div
        className={`group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-200 ${className}`}
      >
        <div className="relative">
          {/* Project Image */}
          <div className="relative aspect-video bg-gray-100 overflow-hidden">
            {project.image_url ? (
              <img
                src={project.image_url}
                alt={project.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
            )}

            {/* Status Badge */}
            <div className="absolute top-3 left-3">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}
              >
                {getStatusText(project.status)}
              </span>
            </div>

            {/* Featured Badge */}
            {project.featured && (
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  ⭐ Featured
                </span>
              </div>
            )}
          </div>

          {/* Project Content */}
          <div className="p-6">
            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
              {project.title}
            </h3>

            {/* Description */}
            <p className="text-gray-600 text-sm mb-4 line-clamp-3">
              {project.short_description ?? project.description}
            </p>

            {/* Technologies */}
            {technologies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {technologies.slice(0, 4).map((tech, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {tech}
                  </span>
                ))}
                {technologies.length > 4 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-500">
                    +{technologies.length - 4} more
                  </span>
                )}
              </div>
            )}

            {/* Links */}
            <div className="flex items-center gap-3">
              {project.github_url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      project.github_url,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                  className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer z-10 relative"
                >
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  Code
                </button>
              )}

              {project.demo_url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      project.demo_url,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                  className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer z-10 relative"
                >
                  <svg
                    className="w-4 h-4 mr-1"
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
                  Demo
                </button>
              )}
            </div>
          </div>

          {/* Invisible clickable area for the main link */}
          <Link
            to={`/projects/${project.slug}`}
            className="absolute inset-0 z-0"
            aria-label={`View ${project.title} details`}
          />
        </div>
      </div>
    );
  },
);

ProjectCard.displayName = "ProjectCard";

export default ProjectCard;
