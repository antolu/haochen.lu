import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, createMockImageFile } from "../../test/utils";
import { ImageCropperModal } from "../../components/admin/ImageCropperModal";

// Mock canvas elements because jsdom doesn't support canvas operations
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  drawImage: vi.fn(),
  fillRect: vi.fn(),
});
HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
  callback(new Blob(["mock-image-data"], { type: "image/jpeg" }));
});

describe("ImageCropperModal", () => {
  it("renders correctly when open with a file", async () => {
    const onCrop = vi.fn();
    const onClose = vi.fn();
    const file = createMockImageFile("project-img.jpg", 1920, 1080);

    const { getByText, findByText } = renderWithProviders(
      <ImageCropperModal
        isOpen={true}
        onClose={onClose}
        file={file}
        aspectRatio={16 / 9}
        onCrop={onCrop}
      />,
    );

    // Dialog should be visible
    expect(getByText("Crop Image")).toBeInTheDocument();
    expect(getByText(/Adjust the framing/i)).toBeInTheDocument();

    // Action buttons should exist
    const cropButton = await findByText("Crop & Upload");
    const cancelButton = await findByText("Cancel");

    expect(cropButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const onCrop = vi.fn();
    const onClose = vi.fn();
    const file = createMockImageFile("project-img.jpg", 1920, 1080);

    const { queryByText } = renderWithProviders(
      <ImageCropperModal
        isOpen={false}
        onClose={onClose}
        file={file}
        onCrop={onCrop}
      />,
    );

    expect(queryByText("Crop Image")).not.toBeInTheDocument();
  });
});
