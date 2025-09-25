import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useInfiniteProjects, type ProjectFilters } from "../hooks/useProjects";
import ProjectGrid from "../components/ProjectGrid";

const ProjectsPage: React.FC = () => {
  const [filters, setFilters] = useState<ProjectFilters>({ order_by: "order" });
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteProjects({
    ...filters,
    search: searchQuery.trim() === "" ? undefined : searchQuery,
  });

  const projects = data?.pages.flatMap((page) => page.projects) ?? [];
  const totalProjects = data?.pages[0]?.total ?? 0;

  const handleSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    // Search is handled by the query automatically when searchQuery changes
  };

  const handleFilterChange = (newFilters: Partial<ProjectFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  if (error) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Failed to load projects
            </h3>
            <p className="text-gray-500 mb-4">
              There was an error loading the projects. Please try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h1
              className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Projects & Work
            </motion.h1>
            <motion.p
              className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Explore my portfolio of applications, tools, and experiments. From
              web applications to open-source contributions, here's what I've
              been building.
            </motion.p>

            {/* Stats */}
            <motion.div
              className="flex justify-center gap-8 text-sm text-gray-500"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <span>{totalProjects} Projects</span>
              <span>•</span>
              <span>Open Source & Commercial</span>
              <span>•</span>
              <span>Continuously Updated</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search and Filters */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* Search */}
              <form onSubmit={handleSearch} className="flex-1 max-w-md">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>
              </form>

              {/* Filter Buttons */}
              <div className="flex gap-2 flex-wrap">
                <FilterButton
                  active={!filters.status && !filters.featured}
                  onClick={() => setFilters({})}
                >
                  All
                </FilterButton>
                {/* Order selector */}
                <select
                  value={filters.order_by ?? "order"}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      order_by: e.target.value as any,
                    }))
                  }
                  className="px-3 py-2 border rounded-lg bg-white text-gray-700"
                >
                  <option value="order">Default</option>
                  <option value="created_at">Created Date</option>
                  <option value="updated_at">Last Updated</option>
                </select>
                <FilterButton
                  active={filters.featured === true}
                  onClick={() =>
                    handleFilterChange({ featured: true, status: undefined })
                  }
                >
                  Featured
                </FilterButton>
                <FilterButton
                  active={filters.status === "active"}
                  onClick={() =>
                    handleFilterChange({
                      status: "active",
                      featured: undefined,
                    })
                  }
                >
                  Active
                </FilterButton>
                <FilterButton
                  active={filters.status === "in_progress"}
                  onClick={() =>
                    handleFilterChange({
                      status: "in_progress",
                      featured: undefined,
                    })
                  }
                >
                  In Progress
                </FilterButton>
              </div>
            </div>

            {/* Results Count */}
            {!isLoading && (
              <div className="mt-4 text-sm text-gray-500">
                {searchQuery && (
                  <span>Search results for "{searchQuery}" • </span>
                )}
                Showing {projects.length} of {totalProjects} projects
              </div>
            )}
          </div>

          {/* Projects Grid */}
          <ProjectGrid
            projects={projects}
            onLoadMore={() => {
              void fetchNextPage();
            }}
            hasMore={hasNextPage}
            isLoading={isLoading}
            isLoadingMore={isFetchingNextPage}
          />
        </div>
      </section>
    </div>
  );
};

// Filter Button Component
interface FilterButtonProps {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}

const FilterButton: React.FC<FilterButtonProps> = ({
  children,
  active = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
};

export default ProjectsPage;
