import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Puzzle } from "lucide-react";

import SubAppForm from "../../components/SubAppForm";
import SubAppList from "../../components/SubAppList";
import { Button } from "../../components/ui/button";
import {
  useSubApps,
  useCreateSubApp,
  useUpdateSubApp,
  useDeleteSubApp,
  useToggleSubAppEnabled,
} from "../../hooks/useSubApps";
import { subapps as subappsApi } from "../../api/client";
import type { SubApp } from "../../types";

interface SubAppFormData {
  name: string;
  url: string;
  admin_url?: string;
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

  // Mutation hooks
  const createMutation = useCreateSubApp();
  const updateMutation = useUpdateSubApp();
  const deleteMutation = useDeleteSubApp();
  const toggleEnabledMutation = useToggleSubAppEnabled();

  const subapps = subappsData?.subapps ?? [];

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

  const handleOpenSubApp = async (subapp: SubApp, target: "app" | "admin") => {
    try {
      if (subapp.requires_auth) {
        const { url } = await subappsApi.getJumpUrl(subapp.slug, target);
        window.open(url, subapp.is_external ? "_blank" : "_self");
        return;
      }

      const destination =
        target === "admin" ? (subapp.admin_url ?? subapp.url) : subapp.url;
      window.open(destination, subapp.is_external ? "_blank" : "_self");
    } catch (error) {
      console.error("Open sub-app error:", error);
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
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <div className="flex justify-between items-center">
          <div className="space-y-3">
            <h1 className="admin-page-title">Sub-Applications</h1>
            <p className="text-muted-foreground text-xl">
              Manage external and internal sub-applications
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/admin/subapps/integrate">
                <Puzzle className="h-4 w-4 mr-2" />
                Integrate Subapp
              </Link>
            </Button>
            <Button
              variant="gradient"
              size="lg"
              onClick={() => handleCreateSubApp()}
              disabled={showForm}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Sub-App
            </Button>
          </div>
        </div>
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
      <div className="bg-card rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">
          All Sub-Applications ({subapps.length})
        </h2>

        <SubAppList
          subapps={subapps}
          onEdit={handleEditSubApp}
          onOpen={(subapp) => {
            void handleOpenSubApp(subapp, "app");
          }}
          onOpenAdmin={(subapp) => {
            void handleOpenSubApp(subapp, "admin");
          }}
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
