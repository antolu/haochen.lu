import React, { useState } from "react";
import { Plus } from "lucide-react";
import { ReorderToggle } from "../../components/admin/ReorderToggle";
import { AdminModal } from "../../components/admin/AdminModal";
import { AdminErrorState } from "../../components/admin/AdminErrorState";
import AppForm from "../../components/AppForm";
import AppList from "../../components/AppList";
import { Button } from "../../components/ui/button";
import { AdminPageLayout } from "../../components/admin/AdminPageLayout";
import {
  useApplications,
  useCreateApplication,
  useDeleteApplication,
  useReorderApplications,
  useToggleAppEnabled,
  useUpdateApplication,
} from "../../hooks/useApplications";
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
  logged_in_only: boolean;
  enabled: boolean;
  redirect_uris?: string;
}

const AdminApplications: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingApplication, setEditingApplication] =
    useState<Application | null>(null);
  const [reorderEnabled, setReorderEnabled] = useState(false);

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
  const reorderMutation = useReorderApplications();

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

  const handleReorder = (items: Array<{ id: string; order: number }>) => {
    reorderMutation.mutate(items);
  };

  const handleOpenApplication = (
    application: Application,
    target: "app" | "admin",
  ) => {
    const destination =
      target === "admin"
        ? (application.admin_url ?? application.url)
        : application.url;
    window.open(destination, "_blank", "noopener,noreferrer");
  };

  const isFormLoading = createMutation.isPending || updateMutation.isPending;

  if (applicationsError) {
    return (
      <AdminErrorState
        message={applicationsError.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <AdminPageLayout
      title="Applications"
      description="Manage external and internal applications"
      actions={
        <>
          <ReorderToggle
            checked={reorderEnabled}
            onCheckedChange={(checked) => {
              if (!apps.length && checked) return;
              setReorderEnabled(checked);
            }}
          />

          <Button
            variant="gradient"
            size="lg"
            onClick={() => handleCreateApplication()}
            disabled={showForm || reorderEnabled}
            className="rounded-full px-8 shadow-xl shadow-primary/20"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Application
          </Button>
        </>
      }
    >
      <AdminModal
        open={showForm}
        title={editingApplication ? "Edit Application" : "Create Application"}
        onClose={handleFormCancel}
        maxWidth="max-w-2xl"
      >
        <AppForm
          application={editingApplication ?? undefined}
          onSubmit={async (data) => {
            await handleFormSubmit(data);
          }}
          onCancel={() => handleFormCancel()}
          isLoading={isFormLoading}
        />
      </AdminModal>

      {/* Sub-Apps List */}
      <div className="bg-card rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">
          All Applications ({apps.length})
        </h2>

        <AppList
          applications={apps}
          reorderEnabled={reorderEnabled}
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
          onReorder={handleReorder}
          isLoading={isLoadingApplications}
        />
      </div>
    </AdminPageLayout>
  );
};

export default AdminApplications;
