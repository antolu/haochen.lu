import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PhotoIcon,
  FolderIcon,
  PencilSquareIcon,
  DocumentTextIcon,
  EyeIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

import { photos, projects, blog, heroImages } from "../../api/client";
import type { PhotoStatsSummary, ProjectStatsSummary } from "../../types";

const AdminDashboard: React.FC = () => {
  const { data: photoStats } = useQuery<PhotoStatsSummary>({
    queryKey: ["admin", "photo-stats"],
    queryFn: photos.getStats,
  });

  const { data: projectStats } = useQuery<ProjectStatsSummary>({
    queryKey: ["admin", "project-stats"],
    queryFn: projects.getStats,
  });

  const { data: blogStats } = useQuery<{ total_posts: number }>({
    queryKey: ["admin", "blog-stats"],
    queryFn: blog.getStats,
  });

  const { data: heroImagesList } = useQuery({
    queryKey: ["admin", "hero-images"],
    queryFn: heroImages.list,
  });

  const stats = [
    {
      name: "Total Photos",
      stat: photoStats?.total_photos ?? 0,
      icon: PhotoIcon,
      color: "bg-blue-500",
    },
    {
      name: "Featured Photos",
      stat: photoStats?.featured_photos ?? 0,
      icon: EyeIcon,
      color: "bg-green-500",
    },
    {
      name: "Hero Images",
      stat: heroImagesList?.length ?? 0,
      icon: SparklesIcon,
      color: "bg-pink-500",
    },
    {
      name: "Projects",
      stat: projectStats?.total_projects ?? 0,
      icon: FolderIcon,
      color: "bg-purple-500",
    },
    {
      name: "Blog Posts",
      stat: blogStats?.total_posts ?? 0,
      icon: PencilSquareIcon,
      color: "bg-orange-500",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome to your admin panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-3 rounded-md ${item.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {item.name}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {item.stat}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <a
              href="/admin/photos"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all duration-200"
            >
              <PhotoIcon className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Upload Photos
                </h3>
                <p className="text-sm text-gray-500">
                  Add new photos to gallery
                </p>
              </div>
            </a>

            <a
              href="/admin/hero-images"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all duration-200"
            >
              <SparklesIcon className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Hero Images
                </h3>
                <p className="text-sm text-gray-500">
                  Manage homepage hero images
                </p>
              </div>
            </a>

            <a
              href="/admin/projects"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all duration-200"
            >
              <FolderIcon className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Manage Projects
                </h3>
                <p className="text-sm text-gray-500">Add or edit projects</p>
              </div>
            </a>

            <a
              href="/admin/blog"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all duration-200"
            >
              <PencilSquareIcon className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Write Blog Post
                </h3>
                <p className="text-sm text-gray-500">Create new blog content</p>
              </div>
            </a>

            <a
              href="/admin/content"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all duration-200"
            >
              <DocumentTextIcon className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Edit Content
                </h3>
                <p className="text-sm text-gray-500">
                  Update website text content
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
