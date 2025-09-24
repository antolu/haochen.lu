import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { heroImages, photos } from "../../api/client";
import type { HeroImage, Photo, HeroImageCreate } from "../../types";
import { selectOptimalImage, ImageUseCase } from "../../utils/imageUtils";
import FocalPointEditor from "./FocalPointEditor";
import SimplePhotoUpload from "../SimplePhotoUpload";

const HeroImageManager: React.FC = () => {
  const [selectedHero, setSelectedHero] = useState<HeroImage | null>(null);
  const [showFocalPointEditor, setShowFocalPointEditor] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [activeTab, setActiveTab] = useState<"upload" | "select">("upload");

  const queryClient = useQueryClient();

  // Fetch hero images
  const {
    data: heroImagesList,
    isLoading: isLoadingHeros,
    error: heroError,
    refetch: fetchHeroImages,
  } = useQuery({
    queryKey: ["hero-images"],
    queryFn: () => heroImages.list(),
  });

  // Fetch photos for selection
  const { data: photosData, isLoading: isLoadingPhotos } = useQuery({
    queryKey: ["photos", "for-hero"],
    queryFn: () => photos.list({ per_page: 50 }),
    enabled: showCreateForm && activeTab === "select",
  });

  // Create hero image mutation
  const createMutation = useMutation({
    mutationFn: (data: HeroImageCreate) => heroImages.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hero-images"] });
      setShowCreateForm(false);
      setSelectedPhoto(null);
    },
  });

  // Activate hero image mutation
  const activateMutation = useMutation({
    mutationFn: (id: string) => heroImages.activate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hero-images"] });
    },
  });

  // Delete hero image mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => heroImages.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hero-images"] });
    },
  });

  useEffect(() => {
    let isMounted = true;

    const loadHeroImages = async () => {
      try {
        await fetchHeroImages();
      } catch (error) {
        console.error("Failed to load hero images", error);
      }
    };

    if (isMounted) {
      void loadHeroImages();
    }

    return () => {
      isMounted = false;
    };
  }, [fetchHeroImages]);

  const handleCreateHeroImage = () => {
    if (!selectedPhoto) return;

    void createMutation.mutate({
      title: `Hero: ${selectedPhoto.title}`,
      photo_id: selectedPhoto.id,
      focal_point_x: 50,
      focal_point_y: 50,
    });
  };

  const handlePhotoUploadComplete = (photo: Photo) => {
    // When photo upload is complete, automatically select it and switch to select tab
    setSelectedPhoto(photo);
    void queryClient.invalidateQueries({ queryKey: ["photos", "for-hero"] });
    setActiveTab("select");
  };

  const handleActivate = (heroImage: HeroImage) => {
    void activateMutation.mutate(heroImage.id);
  };

  const handleDelete = (heroImage: HeroImage) => {
    if (confirm(`Delete hero image "${heroImage.title}"?`)) {
      void deleteMutation.mutate(heroImage.id);
    }
  };

  const handleEditFocalPoints = (heroImage: HeroImage) => {
    setSelectedHero(heroImage);
    setShowFocalPointEditor(true);
  };

  if (isLoadingHeros) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading hero images...</div>
      </div>
    );
  }

  if (heroError) {
    return (
      <div className="text-red-600 p-4">
        Error loading hero images: {heroError.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hero Images</h2>
          <p className="text-gray-600">
            Manage homepage hero images and focal points
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Hero Image
        </button>
      </div>

      {/* Active Hero Indicator */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-800 mb-2">Active Hero Image</h3>
        {(() => {
          const activeHero = heroImagesList?.find((h) => h.is_active);
          if (activeHero) {
            const optimalImage = selectOptimalImage(
              activeHero.photo,
              ImageUseCase.THUMBNAIL,
            );
            return (
              <div className="flex items-center space-x-4">
                <img
                  src={optimalImage.url}
                  alt={activeHero.title}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <div>
                  <div className="font-medium text-green-800">
                    {activeHero.title}
                  </div>
                  <div className="text-sm text-green-600">
                    Focal Point: {activeHero.focal_point_x}%,{" "}
                    {activeHero.focal_point_y}%
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div className="flex items-center space-x-4">
              <img
                src="/images/hero-lg.jpg"
                alt="Default mountain landscape hero image"
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div>
                <div className="font-medium text-green-800">
                  Default Hero Image
                </div>
                <div className="text-sm text-green-600">
                  Using built-in mountain landscape image
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Hero Images Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {heroImagesList?.map((heroImage) => {
          const optimalImage = selectOptimalImage(
            heroImage.photo,
            ImageUseCase.ADMIN,
          );
          return (
            <motion.div
              key={heroImage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-lg shadow-md overflow-hidden border-2 transition-all ${
                heroImage.is_active
                  ? "border-green-500 ring-2 ring-green-200"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {/* Image Preview */}
              <div className="relative aspect-video">
                <img
                  src={optimalImage.url}
                  srcSet={optimalImage.srcset}
                  sizes={optimalImage.sizes}
                  alt={heroImage.title}
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: `${heroImage.focal_point_x}% ${heroImage.focal_point_y}%`,
                  }}
                />
                {heroImage.is_active && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                    ACTIVE
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                  {heroImage.focal_point_x}%, {heroImage.focal_point_y}%
                </div>
              </div>

              {/* Details */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {heroImage.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Photo: {heroImage.photo.title}
                </p>

                {/* Actions */}
                <div className="flex space-x-2">
                  {!heroImage.is_active && (
                    <button
                      onClick={() => handleActivate(heroImage)}
                      disabled={activateMutation.isPending}
                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => handleEditFocalPoints(heroImage)}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    Edit Focus
                  </button>
                  <button
                    onClick={() => handleDelete(heroImage)}
                    disabled={deleteMutation.isPending}
                    className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {heroImagesList?.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No hero images yet</div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Hero Image
          </button>
        </div>
      )}

      {/* Create Form Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Create Hero Image</h3>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setSelectedPhoto(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex mb-6 border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab("upload")}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === "upload"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Upload New Photo
                  </button>
                  <button
                    onClick={() => setActiveTab("select")}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === "select"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Select Existing Photo
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === "upload" && (
                  <div className="mb-6">
                    <SimplePhotoUpload
                      maxFiles={1}
                      category="hero"
                      onComplete={handlePhotoUploadComplete}
                      onCancel={() => {
                        setShowCreateForm(false);
                        setSelectedPhoto(null);
                        setActiveTab("upload");
                      }}
                    />
                  </div>
                )}

                {activeTab === "select" && (
                  <>
                    {/* Default/Static Hero Images Section */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-md font-medium text-gray-900">
                          Default Hero Images
                        </h4>
                        <button
                          onClick={() => {
                            // Clear selected photo to reset to default
                            setSelectedPhoto(null);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          Reset to Default
                        </button>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-4">
                          <img
                            src="/images/hero-lg.jpg"
                            alt="Default mountain landscape hero image"
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <div>
                            <div className="font-medium text-gray-900">
                              Mountain Landscape
                            </div>
                            <div className="text-sm text-gray-600">
                              Default static hero image with mountain landscape
                            </div>
                            {!selectedPhoto && (
                              <div className="text-xs text-blue-600 font-medium mt-1">
                                ✓ Currently using default
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="mb-6">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">
                            or
                          </span>
                        </div>
                      </div>
                    </div>

                    {isLoadingPhotos ? (
                      <div className="text-center py-8">Loading photos...</div>
                    ) : (
                      <>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Uploaded Photo for Hero Image
                          </label>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 max-h-96 overflow-y-auto">
                          {photosData?.photos.map((photo) => {
                            const optimalImage = selectOptimalImage(
                              photo,
                              ImageUseCase.THUMBNAIL,
                            );
                            return (
                              <button
                                key={photo.id}
                                onClick={() => setSelectedPhoto(photo)}
                                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                  selectedPhoto?.id === photo.id
                                    ? "border-blue-500 ring-2 ring-blue-200"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                <img
                                  src={optimalImage.url}
                                  alt={photo.title}
                                  className="w-full h-full object-cover"
                                />
                                {selectedPhoto?.id === photo.id && (
                                  <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                    <div className="bg-blue-500 text-white rounded-full p-1">
                                      ✓
                                    </div>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {selectedPhoto && (
                          <div className="bg-gray-50 rounded-lg p-4 mb-6">
                            <h4 className="font-medium text-gray-900 mb-2">
                              Selected Photo
                            </h4>
                            <div className="flex items-center space-x-4">
                              <img
                                src={
                                  selectOptimalImage(
                                    selectedPhoto,
                                    ImageUseCase.THUMBNAIL,
                                  ).url
                                }
                                alt={selectedPhoto.title}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                              <div>
                                <div className="font-medium">
                                  {selectedPhoto.title}
                                </div>
                                {selectedPhoto.description && (
                                  <div className="text-sm text-gray-600">
                                    {selectedPhoto.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex space-x-4">
                          <button
                            onClick={() => {
                              setShowCreateForm(false);
                              setSelectedPhoto(null);
                              setActiveTab("upload");
                            }}
                            className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (selectedPhoto) {
                                handleCreateHeroImage();
                              } else {
                                // Handle reset to default - deactivate all hero images
                                const activeHero = heroImagesList?.find(
                                  (h) => h.is_active,
                                );
                                if (activeHero) {
                                  // Deactivate current hero to use default
                                  void deleteMutation.mutate(activeHero.id);
                                }
                                setShowCreateForm(false);
                                setActiveTab("upload");
                              }
                            }}
                            disabled={
                              createMutation.isPending ||
                              deleteMutation.isPending
                            }
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {createMutation.isPending ||
                            deleteMutation.isPending
                              ? "Processing..."
                              : selectedPhoto
                                ? "Create Hero Image"
                                : "Reset to Default"}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focal Point Editor */}
      {selectedHero && (
        <FocalPointEditor
          heroImage={selectedHero}
          isOpen={showFocalPointEditor}
          onClose={() => {
            setShowFocalPointEditor(false);
            setSelectedHero(null);
          }}
        />
      )}
    </div>
  );
};

export default HeroImageManager;
