import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders, mockPhoto } from "../utils";
import PhotoGrid from "../../components/PhotoGrid";
import type { Photo } from "../../types";

// jsdom's IntersectionObserver mock isn't constructible, which crashes
// react-intersection-observer's useInView. Mock it to always report inView.
vi.mock("react-intersection-observer", () => ({
  useInView: () => ({ ref: vi.fn(), inView: true }),
}));

// react-photo-album's row-packing layout depends on a real container width,
// which jsdom always reports as 0. Mock it with a minimal pass-through that
// invokes render.photo for each photo so we can test PhotoGrid's own logic.
vi.mock("react-photo-album", () => ({
  RowsPhotoAlbum: ({ photos, render }: any) => (
    <div data-testid="rows-photo-album">
      {photos.map((photo: any, index: number) =>
        render.photo(
          { onClick: undefined },
          { photo, index, width: photo.width, height: photo.height },
        ),
      )}
    </div>
  ),
}));

const buildPhoto = (overrides: Partial<Photo> = {}): Photo => ({
  ...mockPhoto,
  filename: "photo.jpg",
  original_path: "/uploads/photo.jpg",
  ...overrides,
});

describe("PhotoGrid", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading and empty states", () => {
    it("renders loading skeleton when isLoading and no photos", () => {
      renderWithProviders(<PhotoGrid photos={[]} isLoading={true} />);

      expect(screen.getByTestId("loading-grid")).toBeInTheDocument();
      expect(screen.getAllByTestId("skeleton-item").length).toBe(20);
    });

    it("renders empty state when no photos and not loading", () => {
      renderWithProviders(<PhotoGrid photos={[]} isLoading={false} />);

      expect(screen.getByText(/no photos found/i)).toBeInTheDocument();
      expect(
        screen.getByText(/upload some photos to see them here/i),
      ).toBeInTheDocument();
    });

    it("does not render loading skeleton once photos are present", () => {
      renderWithProviders(
        <PhotoGrid photos={[buildPhoto()]} isLoading={true} />,
      );

      expect(screen.queryByTestId("loading-grid")).not.toBeInTheDocument();
      expect(screen.getByTestId("rows-photo-album")).toBeInTheDocument();
    });
  });

  describe("Rendering photos", () => {
    it("renders a photo card for each photo", () => {
      const photos = [
        buildPhoto({ id: "photo-1", title: "First" }),
        buildPhoto({ id: "photo-2", title: "Second" }),
      ];

      renderWithProviders(<PhotoGrid photos={photos} isLoading={false} />);

      expect(screen.getByTestId("photo-card-1")).toBeInTheDocument();
      expect(screen.getByTestId("photo-card-2")).toBeInTheDocument();
    });

    it("shows the featured badge only for featured photos", () => {
      const photos = [
        buildPhoto({ id: "photo-1", is_featured: false } as Partial<Photo>),
        buildPhoto({ id: "photo-2", featured: true } as Partial<Photo>),
      ];

      renderWithProviders(<PhotoGrid photos={photos} isLoading={false} />);

      const cards = screen.getAllByTestId(/photo-card-/);
      expect(cards[0].querySelector("svg")).not.toBeInTheDocument();
      expect(cards[1].querySelector("svg")).toBeInTheDocument();
    });

    it("renders metadata overlay when showMetadata is true", () => {
      const photo = buildPhoto({
        id: "photo-1",
        title: "Sunset",
        location_name: "Tokyo",
        date_taken: "2023-05-01T00:00:00Z",
      } as Partial<Photo>);

      renderWithProviders(
        <PhotoGrid photos={[photo]} isLoading={false} showMetadata />,
      );

      // Metadata overlay only renders once the image has loaded
      fireEvent.load(screen.getByRole("img"));

      expect(screen.getByText("Sunset")).toBeInTheDocument();
      expect(screen.getByText(/Tokyo/)).toBeInTheDocument();
    });

    it("does not render metadata overlay when showMetadata is false", () => {
      const photo = buildPhoto({
        id: "photo-1",
        title: "Sunset",
      } as Partial<Photo>);

      renderWithProviders(
        <PhotoGrid photos={[photo]} isLoading={false} showMetadata={false} />,
      );

      expect(screen.queryByText("Sunset")).not.toBeInTheDocument();
    });
  });

  describe("Interaction", () => {
    it("calls onPhotoClick with the photo and index when clicked", () => {
      const onPhotoClick = vi.fn();
      const photos = [
        buildPhoto({ id: "photo-1" }),
        buildPhoto({ id: "photo-2" }),
      ];

      renderWithProviders(
        <PhotoGrid
          photos={photos}
          isLoading={false}
          onPhotoClick={onPhotoClick}
        />,
      );

      fireEvent.click(screen.getByTestId("photo-card-2"));

      expect(onPhotoClick).toHaveBeenCalledTimes(1);
      expect(onPhotoClick).toHaveBeenCalledWith(photos[1], 1);
    });

    it("does not throw when onPhotoClick is not provided", () => {
      renderWithProviders(
        <PhotoGrid photos={[buildPhoto()]} isLoading={false} />,
      );

      expect(() => {
        fireEvent.click(screen.getByTestId("photo-card-1"));
      }).not.toThrow();
    });
  });

  describe("Highlighting", () => {
    it("applies highlighted styling to the matching photo", () => {
      const photos = [
        buildPhoto({ id: "photo-1" }),
        buildPhoto({ id: "photo-2" }),
      ];

      renderWithProviders(
        <PhotoGrid
          photos={photos}
          isLoading={false}
          highlightedPhotoId="photo-2"
        />,
      );

      expect(screen.getByTestId("photo-card-1")).not.toHaveClass(
        "ring-blue-500",
      );
      expect(screen.getByTestId("photo-card-2")).toHaveClass("ring-blue-500");
    });

    it("does not highlight any photo when highlightedPhotoId is null", () => {
      const photos = [buildPhoto({ id: "photo-1" })];

      renderWithProviders(
        <PhotoGrid
          photos={photos}
          isLoading={false}
          highlightedPhotoId={null}
        />,
      );

      expect(screen.getByTestId("photo-card-1")).not.toHaveClass(
        "ring-blue-500",
      );
    });
  });

  describe("Transitioning state", () => {
    it("shows the loading new order indicator when isTransitioning is true", () => {
      renderWithProviders(
        <PhotoGrid photos={[buildPhoto()]} isLoading={false} isTransitioning />,
      );

      expect(screen.getByText(/loading new order/i)).toBeInTheDocument();
    });

    it("applies transitioning styling to the container", () => {
      renderWithProviders(
        <PhotoGrid photos={[buildPhoto()]} isLoading={false} isTransitioning />,
      );

      expect(screen.getByTestId("photo-grid-container")).toHaveClass(
        "transitioning",
      );
    });
  });

  describe("Image loading and errors", () => {
    it("shows loading skeleton for a photo before its image loads", () => {
      renderWithProviders(
        <PhotoGrid photos={[buildPhoto()]} isLoading={false} />,
      );

      expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
    });

    it("shows fallback message when the image fails to load", () => {
      renderWithProviders(
        <PhotoGrid photos={[buildPhoto()]} isLoading={false} />,
      );

      const img = screen.getByRole("img");
      fireEvent.error(img);

      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
