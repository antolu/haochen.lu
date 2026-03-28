import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FileCode2 } from "lucide-react";

import AppForm from "../../components/AppForm";
import AppList from "../../components/AppList";
import { Button } from "../../components/ui/button";
import {
  useApplications,
  useCreateApplication,
  useUpdateApplication,
  useDeleteApplication,
  useToggleAppEnabled,
} from "../../hooks/useApplications";
import { applications as applicationsApi } from "../../api/client";
import type { Application } from "../../types";

interface AppFormData {
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

const AdminApplications: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingApplication, setEditingApplication] =
    useState<Application | null>(null);

  // Query hooks
  const {
    data: applicationsData,
    isLoading: isLoadingApplications,
    error: applicationsError,
  } = useApplications();

  // Mutation hooks
  const createMutation = useCreateApplication();
  const updateMutation = useUpdateApplication();
  const deleteMutation = useDeleteApplication();
  const toggleEnabledMutation = useToggleAppEnabled();

  const apps = applicationsData?.applications ?? [];

  const handleCreateApplication = () => {
    setEditingApplication(null);
    setShowForm(true);
  };

  const handleEditApplication = (application: Application) => {
    setEditingApplication(application);
    setShowForm(true);
  };

  const handleFormSubmit = async (data: AppFormData) => {
    try {
      if (editingApplication) {
        await updateMutation.mutateAsync({
          id: editingApplication.id,
          data,
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      setShowForm(false);
      setEditingApplication(null);
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error("Form submission error:", error);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingApplication(null);
  };

  const handleDeleteApplication = async (applicationId: string) => {
    try {
      await deleteMutation.mutateAsync(applicationId);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Delete error:", error);
    }
  };

  const handleToggleEnabled = async (
    applicationId: string,
    enabled: boolean,
  ) => {
    try {
      await toggleEnabledMutation.mutateAsync({ id: applicationId, enabled });
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Toggle enabled error:", error);
    }
  };

  const handleOpenApplication = async (
    application: Application,
    target: "app" | "admin",
  ) => {
    try {
      if (application.requires_auth) {
        const { url } = await applicationsApi.getJumpUrl(
          application.slug,
          target,
        );
        window.open(url, application.is_external ? "_blank" : "_self");
        return;
      }

      const destination =
        target === "admin"
          ? (application.admin_url ?? application.url)
          : application.url;
      window.open(destination, application.is_external ? "_blank" : "_self");
    } catch (error) {
      console.error("Open application error:", error);
    }
  };

  const isFormLoading = createMutation.isPending || updateMutation.isPending;

  if (applicationsError) {
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
          Error loading applications
        </div>
        <p className="text-muted-foreground">{applicationsError.message}</p>
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
            <h1 className="admin-page-title">Applications</h1>
            <p className="text-muted-foreground text-xl">
              Manage external and internal applications
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/admin/applications/import">
                <FileCode2 className="h-4 w-4 mr-2" />
                Import via YAML
              </Link>
            </Button>
            <Button
              variant="gradient"
              size="lg"
              onClick={() => handleCreateApplication()}
              disabled={showForm}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Application
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
              className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-foreground">
                    {editingApplication
                      ? "Edit Application"
                      : "Create Application"}
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

                <AppForm
                  application={editingApplication ?? undefined}
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
          All Applications ({apps.length})
        </h2>

        <AppList
          applications={apps}
          onEdit={handleEditApplication}
          onOpen={(application) => {
            void handleOpenApplication(application, "app");
          }}
          onOpenAdmin={(application) => {
            void handleOpenApplication(application, "admin");
          }}
          onDelete={(id) => {
            void handleDeleteApplication(id);
          }}
          onToggleEnabled={(id, enabled) => {
            void handleToggleEnabled(id, enabled);
          }}
          isLoading={isLoadingApplications}
        />
      </div>
    </div>
  );
};

export default AdminApplications;
