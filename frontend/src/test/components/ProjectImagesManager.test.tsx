import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  renderWithProviders,
  userEvent,
  createMockImageFile,
} from "../../test/utils";
import ProjectImagesManager from "../../components/admin/ProjectImagesManager";
import * as useProjectsModule from "../../hooks/useProjects";

// Mock canvas elements because jsdom doesn't support canvas operations
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  drawImage: vi.fn(),
  fillRect: vi.fn(),
});
HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
  callback(new Blob(["mock-image-data"], { type: "image/jpeg" }));
});

// Mock the react query hooks
vi.mock("../../hooks/useProjects", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../hooks/useProjects")>();
  return {
    ...actual,
    useProjectImages: vi.fn(),
    useAttachProjectImage: vi.fn(),
    useRemoveProjectImage: vi.fn(),
    useReorderProjectImages: vi.fn(),
    useUpdateProjectImage: vi.fn(),
  };
});

// Mock DndContext to bypass complex browser geometry calculation
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({ children }: any) => (
      <div data-testid="dnd-context">{children}</div>
    ),
  };
});

describe("ProjectImagesManager", () => {
  const mockRefetch = vi.fn();
  const mockAttachMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useProjectsModule.useProjectImages).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: mockRefetch,
    } as any);

    vi.mocked(useProjectsModule.useAttachProjectImage).mockReturnValue({
      mutateAsync: mockAttachMutateAsync,
    } as any);

    vi.mocked(useProjectsModule.useRemoveProjectImage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(useProjectsModule.useReorderProjectImages).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(useProjectsModule.useUpdateProjectImage).mockReturnValue({
      mutateAsync: vi.fn(),
    } as any);
  });

  it("opens cropper when an image is dropped and uploads cropped result", async () => {
    const { container, findByText, queryByText } = renderWithProviders(
      <ProjectImagesManager projectId="proj-1" />,
    );

    // Initial state: Cropper is not open
    expect(queryByText("Crop Image")).not.toBeInTheDocument();

    // Find the dropzone input and upload a file
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = createMockImageFile("new-photo.jpg", 1920, 1080);
    await userEvent.upload(fileInput!, file);

    // After selecting a file, the cropper modal should appear
    const cropperTitle = await findByText("Crop Image");
    expect(cropperTitle).toBeInTheDocument();

    // Trigger image load to initialize crop state
    const img = document.querySelector('img[alt="Crop preview"]');
    if (img) {
      import("@testing-library/react").then(({ fireEvent }) => {
        fireEvent.load(img, { target: { width: 1920, height: 1080 } });
      });
    }

    // Click "Crop & Upload" in the modal
    const cropUploadBtn = await findByText("Crop & Upload");
    await userEvent.click(cropUploadBtn);

    // Verify attachMutation was called with a cropped File
    expect(mockAttachMutateAsync).toHaveBeenCalledTimes(1);
    const uploadedArg = mockAttachMutateAsync.mock.calls[0][0];
    expect(uploadedArg.file).toBeInstanceOf(File);
    expect(uploadedArg.file.name).toContain("cropped");

    // Cropper should close after successful upload
    expect(queryByText("Crop Image")).not.toBeInTheDocument();

    // refetch should be called to update the list
    expect(mockRefetch).toHaveBeenCalled();
  });
});
