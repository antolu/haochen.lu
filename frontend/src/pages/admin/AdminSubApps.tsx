import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import SubAppForm from "../../components/SubAppForm";
import SubAppList from "../../components/SubAppList";
import {
  useSubApps,
  useSubAppStats,
  useCreateSubApp,
  useUpdateSubApp,
  useDeleteSubApp,
  useToggleSubAppEnabled,
} from "../../hooks/useSubApps";
import type { SubApp } from "../../types";

interface SubAppFormData {
  name: string;
  url: string;
  description?: string;
  icon?: string;
  color?: string;
  is_external: boolean;
  requires_auth: boolean;
  admin_only: boolean;
  show_in_menu: boolean;
  enabled: boolean;
  order: number;
}

const AdminSubApps: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingSubApp, setEditingSubApp] = useState<SubApp | null>(null);

  // Query hooks
  const {
    data: subappsData,
    isLoading: isLoadingSubApps,
    error: subappsError,
  } = useSubApps();
  const { data: statsData, isLoading: isLoadingStats } = useSubAppStats();

  // Mutation hooks
  const createMutation = useCreateSubApp();
  const updateMutation = useUpdateSubApp();
  const deleteMutation = useDeleteSubApp();
  const toggleEnabledMutation = useToggleSubAppEnabled();

  const subapps = subappsData?.subapps ?? [];
  const stats = statsData ?? {
    total_subapps: 0,
    enabled_subapps: 0,
    disabled_subapps: 0,
  };

  const handleCreateSubApp = () => {
    setEditingSubApp(null);
    setShowForm(true);
  };

  const handleEditSubApp = (subapp: SubApp) => {
    setEditingSubApp(subapp);
    setShowForm(true);
  };

  const handleFormSubmit = async (data: SubAppFormData) => {
    try {
      if (editingSubApp) {
        await updateMutation.mutateAsync({
          id: editingSubApp.id,
          data,
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      setShowForm(false);
      setEditingSubApp(null);
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error("Form submission error:", error);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSubApp(null);
  };

  const handleDeleteSubApp = async (subappId: string) => {
    try {
      await deleteMutation.mutateAsync(subappId);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Delete error:", error);
    }
  };

  const handleToggleEnabled = async (subappId: string, enabled: boolean) => {
    try {
      await toggleEnabledMutation.mutateAsync({ id: subappId, enabled });
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Toggle enabled error:", error);
    }
  };

  const isFormLoading = createMutation.isPending || updateMutation.isPending;

  if (subappsError) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive mb-4">
          <svg
            className="h-12 w-12 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          Error loading sub-applications
        </div>
        <p className="text-muted-foreground">{subappsError.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Sub-Applications
            </h1>
            <p className="mt-2 text-muted-foreground">
              Manage external and internal sub-applications
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/admin/subapps/integrate"
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              <span className="flex items-center">
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
                Integrate Subapp
              </span>
            </Link>
            <button
              onClick={() => handleCreateSubApp()}
              disabled={showForm}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <span className="flex items-center">
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Sub-App
              </span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {!isLoadingStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14-7H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-foreground">
                    Total Sub-Apps
                  </p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.total_subapps}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-green-100 dark:bg-green-950 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-foreground">Enabled</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats.enabled_subapps}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-orange-100 dark:bg-orange-950 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-orange-600 dark:text-orange-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-foreground">
                    Disabled
                  </p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {stats.disabled_subapps}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleFormCancel();
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-foreground">
                    {editingSubApp
                      ? "Edit Sub-Application"
                      : "Create New Sub-Application"}
                  </h2>
                  <button
                    onClick={handleFormCancel}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <SubAppForm
                  subapp={editingSubApp ?? undefined}
                  onSubmit={async (data) => {
                    await handleFormSubmit(data);
                  }}
                  onCancel={() => handleFormCancel()}
                  isLoading={isFormLoading}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-Apps List */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">
          All Sub-Applications ({subapps.length})
        </h2>

        <SubAppList
          subapps={subapps}
          onEdit={handleEditSubApp}
          onDelete={(id) => {
            void handleDeleteSubApp(id);
          }}
          onToggleEnabled={(id, enabled) => {
            void handleToggleEnabled(id, enabled);
          }}
          isLoading={isLoadingSubApps}
        />
      </div>
    </div>
  );
};

export default AdminSubApps;
