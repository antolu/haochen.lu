import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload } from "lucide-react";
import ProfilePictureUpload from "../ProfilePictureUpload";
import {
  useProfilePictures,
  useActiveProfilePicture,
  useUploadProfilePicture,
  useActivateProfilePicture,
  useDeleteProfilePicture,
} from "../../hooks/useProfilePictures";
import { ImageUseCase } from "../../utils/imageUtils";
import ProgressiveImage from "../ProgressiveImage";
import type { ProfilePicture } from "../../types";
import { Button } from "../ui/button";

const ProfilePictureManager: React.FC = () => {
  const [showUpload, setShowUpload] = useState(false);

  // Query hooks
  const { data: profilePicturesData, isLoading, error } = useProfilePictures();
  const { data: activeData } = useActiveProfilePicture();

  // Mutation hooks
  const uploadMutation = useUploadProfilePicture();
  const activateMutation = useActivateProfilePicture();
  const deleteMutation = useDeleteProfilePicture();

  const profilePictures = profilePicturesData?.profile_pictures ?? [];
  const activeProfilePicture = activeData?.profile_picture;

  const handleUpload = async (file: File, title?: string) => {
    try {
      await uploadMutation.mutateAsync({ file, title });
      setShowUpload(false);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateMutation.mutateAsync(id);
    } catch (error) {
      console.error("Activation failed:", error);
    }
  };

  const handleDelete = async (profilePicture: ProfilePicture) => {
    const confirmMessage = `Are you sure you want to delete "${profilePicture.title ?? "this profile picture"}"? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      await deleteMutation.mutateAsync(profilePicture.id);
    } catch (error) {
      console.error("Deletion failed:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (error) {
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
          Error loading profile pictures
        </div>
        <p className="text-muted-foreground">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-semibold">Profile Pictures</h2>
          <Button
            variant="gradient"
            size="lg"
            onClick={() => setShowUpload(true)}
            className="rounded-full shadow-lg shadow-primary/20"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload New Picture
          </Button>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto"
            >
              <ProfilePictureUpload
                onUpload={handleUpload}
                onCancel={() => setShowUpload(false)}
                isUploading={uploadMutation.isPending}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Pictures Grid */}
      <div className="bg-card rounded-xl shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-medium mb-4">All Profile Pictures</h2>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : profilePictures.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="h-12 w-12 mx-auto text-muted-foreground mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-muted-foreground mb-4">
                No profile pictures uploaded yet
              </p>
              <button
                onClick={() => setShowUpload(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Upload Your First Picture
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profilePictures.map((profilePicture) => {
                const isActive = profilePicture.id === activeProfilePicture?.id;

                return (
                  <div
                    key={profilePicture.id}
                    className={`relative bg-card rounded-xl overflow-hidden transition-all ${
                      isActive ? "ring-2 ring-primary" : "hover:shadow-md"
                    }`}
                  >
                    {/* Active Badge */}
                    {isActive && (
                      <div className="absolute top-2 left-2 z-10">
                        <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full">
                          Active
                        </span>
                      </div>
                    )}

                    {/* Image */}
                    <div className="aspect-square bg-muted">
                      <ProgressiveImage
                        photo={{
                          filename: profilePicture.filename,
                          original_url: profilePicture.original_url,
                          variants: profilePicture.variants as Record<
                            string,
                            { url?: string; width: number }
                          >,
                        }}
                        useCase={ImageUseCase.THUMBNAIL}
                        alt={profilePicture.title ?? "Profile Picture"}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-medium truncate">
                        {profilePicture.title ?? "Untitled"}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {profilePicture.width}×{profilePicture.height} •{" "}
                        {formatFileSize(profilePicture.file_size ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {new Date(
                          profilePicture.created_at,
                        ).toLocaleDateString()}
                      </p>

                      {/* Actions */}
                      <div className="flex space-x-2 mt-3">
                        {!isActive && (
                          <Button
                            onClick={() =>
                              void handleActivate(profilePicture.id)
                            }
                            disabled={activateMutation.isPending}
                            className="flex-1"
                            size="sm"
                          >
                            {activateMutation.isPending
                              ? "Setting..."
                              : "Set Active"}
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          onClick={() => void handleDelete(profilePicture)}
                          disabled={deleteMutation.isPending}
                          className="flex-1"
                          size="sm"
                        >
                          {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePictureManager;
