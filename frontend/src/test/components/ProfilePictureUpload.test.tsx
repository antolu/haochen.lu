import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  renderWithProviders,
  userEvent,
  createMockImageFile,
} from "../../test/utils";
import ProfilePictureUpload from "../../components/ProfilePictureUpload";

describe("ProfilePictureUpload", () => {
  it("renders cropping UI after selecting an image (1:1 square flow)", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    const { container, findByRole } = renderWithProviders(
      <ProfilePictureUpload
        onUpload={onUpload}
        onCancel={onCancel}
        isUploading={false}
      />,
    );

    const fileInput = container.querySelector(
      'input[type="file"].hidden[accept="image/*"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    const file = createMockImageFile("avatar.jpg", 800, 600);
    await userEvent.upload(fileInput as HTMLInputElement, file);

    await findByRole("button", { name: /^upload$/i });
  });
});
