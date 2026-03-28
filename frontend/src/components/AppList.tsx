import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Application } from "../types";
import { formatDateSimple } from "../utils/dateFormat";
import { applications as applicationsApi } from "../api/client";

interface AppListProps {
  applications: Application[];
  onEdit: (application: Application) => void;
  onDelete: (applicationId: string) => void;
  onToggleEnabled: (applicationId: string, enabled: boolean) => void;
  onOpen: (application: Application) => void;
  onOpenAdmin: (application: Application) => void;
  isLoading?: boolean;
}

const AppList: React.FC<AppListProps> = ({
  applications,
  onEdit,
  onDelete,
  onToggleEnabled,
  onOpen,
  onOpenAdmin,
  isLoading = false,
}) => {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleExport = async (application: Application) => {
    setExportingId(application.id);
    try {
      await applicationsApi.exportYaml(application.id, application.slug);
    } finally {
      setExportingId(null);
    }
  };

  const filteredApplications = applications.filter(
    (app) =>
      app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDeleteClick = (applicationId: string) => {
    setDeleteConfirm(applicationId);
  };

  const handleDeleteConfirm = (applicationId: string) => {
    onDelete(applicationId);
    setDeleteConfirm(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const getStatusBadge = (application: Application) => {
    if (!application.enabled) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Disabled
        </span>
      );
    }

    if (application.admin_only) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Admin Only
        </span>
      );
    }

    if (application.requires_auth) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Auth Required
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Public
      </span>
    );
  };

  const renderIcon = (application: Application) => {
    if (!application.icon) {
      return (
        <div className="h-8 w-8 bg-gray-200 rounded-lg flex items-center justify-center">
          <span className="text-gray-500 text-sm font-medium">
            {application.name.charAt(0).toUpperCase()}
          </span>
        </div>
      );
    }

    // Check if icon is an emoji (single character) or URL
    if (application.icon.length <= 2) {
      return (
        <div className="h-8 w-8 flex items-center justify-center text-lg">
          {application.icon}
        </div>
      );
    }

    // Assume it's an image URL
    return (
      <img
        src={application.icon}
        alt={`${application.name} icon`}
        className="h-8 w-8 rounded-lg object-cover"
        onError={(e) => {
          // Fallback to initial letter if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const fallback = target.parentElement?.querySelector(".fallback");
          if (fallback) {
            (fallback as HTMLElement).style.display = "flex";
          }
        }}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="bg-card rounded-lg border border-border p-6"
          >
            <div className="animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="h-8 w-8 bg-muted rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="h-6 bg-muted rounded-full w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search apps..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      </div>

      {/* Applications List */}
      <AnimatePresence>
        {filteredApplications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <div className="text-gray-500">
              {searchTerm
                ? "No apps match your search."
                : "No apps found. Create your first one!"}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((application) => (
              <motion.div
                key={application.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-card rounded-lg border border-border p-6 hover:border-border/80 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    {/* Icon */}
                    <div className="relative">
                      {renderIcon(application)}
                      <div className="fallback h-8 w-8 bg-gray-200 rounded-lg hidden items-center justify-center">
                        <span className="text-gray-500 text-sm font-medium">
                          {application.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-foreground truncate">
                          {application.name}
                        </h3>
                        {getStatusBadge(application)}
                        {application.is_external && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            External
                          </span>
                        )}
                        {!application.show_in_menu && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Hidden
                          </span>
                        )}
                      </div>

                      <div className="mt-1">
                        <a
                          href={application.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate block"
                        >
                          {application.url}
                        </a>
                      </div>

                      {application.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {application.description}
                        </p>
                      )}

                      <div className="mt-2 flex items-center text-xs text-muted-foreground space-x-4">
                        <span>Order: {application.order}</span>
                        <span>
                          Created: {formatDateSimple(application.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => onOpen(application)}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded transition-colors"
                      title="Open App"
                    >
                      Open
                    </button>

                    {application.admin_url && (
                      <button
                        onClick={() => onOpenAdmin(application)}
                        className="px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-100 hover:bg-violet-200 rounded transition-colors"
                        title="Open Admin"
                      >
                        Admin
                      </button>
                    )}

                    {/* Toggle Enable/Disable */}
                    <button
                      onClick={() =>
                        onToggleEnabled(application.id, !application.enabled)
                      }
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        application.enabled
                          ? "text-orange-700 bg-orange-100 hover:bg-orange-200"
                          : "text-green-700 bg-green-100 hover:bg-green-200"
                      }`}
                      title={application.enabled ? "Disable" : "Enable"}
                    >
                      {application.enabled ? "Disable" : "Enable"}
                    </button>

                    {/* Export Button */}
                    <button
                      onClick={() => {
                        void handleExport(application);
                      }}
                      disabled={exportingId === application.id}
                      className="px-3 py-1.5 text-xs font-medium text-cyan-700 bg-cyan-100 hover:bg-cyan-200 disabled:opacity-50 rounded transition-colors"
                      title="Export YAML"
                    >
                      {exportingId === application.id ? "..." : "Export"}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => onEdit(application)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                      title="Edit"
                    >
                      Edit
                    </button>

                    {/* Delete Button */}
                    {deleteConfirm === application.id ? (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleDeleteConfirm(application.id)}
                          className="px-2 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                          title="Confirm Delete"
                        >
                          Yes
                        </button>
                        <button
                          onClick={handleDeleteCancel}
                          className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                          title="Cancel Delete"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDeleteClick(application.id)}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                        title="Delete"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppList;
