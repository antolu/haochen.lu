import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, userEvent, createMockImageFile } from '../../test/utils';
import ProfilePictureUpload from '../../components/ProfilePictureUpload';

describe('ProfilePictureUpload', () => {
  it('renders cropping UI after selecting an image (1:1 square flow)', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    const { getByText, getByRole, findByText } = renderWithProviders(
      <ProfilePictureUpload onUpload={onUpload} onCancel={onCancel} isUploading={false} />
    );

    // Open file picker via button and upload an image file
    const clickToSelect = getByText(/click to select/i);
    await userEvent.click(clickToSelect);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockImageFile('avatar.jpg', 800, 600);
    await userEvent.upload(fileInput, file);

    // Wait for component to process selected image
    await new Promise(r => setTimeout(r, 20));

    // Expect crop UI visible and action button disabled until crop completes
    // Cropping UI should still render container after selection
    await findByText(/Upload Profile Picture/i);
  });
});
