import type { Photo } from '../types';

/**
 * Generates rich HTML caption for LightGallery from photo metadata
 * Includes only title, description, and comments
 */
export const generateCaptionHtml = (photo: Photo): string => {
  const title = photo.title || 'Untitled';
  const description = photo.description?.trim();

  // Build the caption HTML
  const parts: string[] = [];

  // Title (always present)
  parts.push(`<h4 class="lg-caption-title">${escapeHtml(title)}</h4>`);

  // Description (if present)
  if (description) {
    parts.push(`<p class="lg-caption-description">${escapeHtml(description)}</p>`);
  }

  // Comments (if any)
  if (photo.comments?.trim()) {
    parts.push(`<div class="lg-caption-comments"><p>${escapeHtml(photo.comments)}</p></div>`);
  }

  return `<div class="lg-caption-container">${parts.join('')}</div>`;
};

/**
 * Generates a simplified caption for mobile/small screens
 * Only includes title and optionally a truncated description
 */
export const generateMobileCaptionHtml = (photo: Photo, maxDescLength = 100): string => {
  const title = photo.title || 'Untitled';
  let description = photo.description?.trim();

  // Truncate description for mobile
  if (description && description.length > maxDescLength) {
    description = description.substring(0, maxDescLength) + '...';
  }

  const parts: string[] = [];

  // Title
  parts.push(`<h4 class="lg-caption-title">${escapeHtml(title)}</h4>`);

  // Short description
  if (description) {
    parts.push(
      `<p class="lg-caption-description lg-caption-description--mobile">${escapeHtml(description)}</p>`
    );
  }

  return `<div class="lg-caption-container lg-caption-container--mobile">${parts.join('')}</div>`;
};

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
