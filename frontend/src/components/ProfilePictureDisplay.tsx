import React from "react";
import { useQuery } from "@tanstack/react-query";
import { profilePictures } from "../api/client";
import { selectOptimalImage, ImageUseCase } from "../utils/imageUtils";
// Note: type-only import removed to avoid unused warnings

export interface ProfilePictureDisplayProps {
  className?: string;
  fallback?: string;
  size?: "small" | "medium" | "large";
}

const ProfilePictureDisplay: React.FC<ProfilePictureDisplayProps> = ({
  className = "",
  fallback = "AL",
  size = "large",
}) => {
  const { data: activeProfilePicture, isLoading } = useQuery({
    queryKey: ["profile-pictures", "active"],
    queryFn: profilePictures.getActive,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const profilePicture = activeProfilePicture?.profile_picture;

  // Show fallback while loading or if no active profile picture
  if (isLoading || !profilePicture) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-primary text-primary-foreground font-light ${className}`}
      >
        <span
          className={`${size === "small" ? "text-2xl" : size === "medium" ? "text-4xl" : "text-6xl"}`}
        >
          {fallback}
        </span>
      </div>
    );
  }

  // Select optimal image variant based on display size
  const useCase =
    size === "small"
      ? ImageUseCase.THUMBNAIL
      : size === "medium"
        ? ImageUseCase.GALLERY
        : ImageUseCase.HERO;

  const optimalImage = selectOptimalImage(
    {
      // Provide minimal PhotoLike shape
      filename: profilePicture.filename,
      original_url: profilePicture.original_url,
      variants: profilePicture.variants as Record<
        string,
        { url?: string; width: number }
      >,
    },
    useCase,
  );

  return (
    <div className={`overflow-hidden ${className}`}>
      <img
        src={optimalImage.url}
        srcSet={optimalImage.srcset}
        sizes={optimalImage.sizes}
        alt={profilePicture.title ?? "Profile Picture"}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
};

export default ProfilePictureDisplay;
