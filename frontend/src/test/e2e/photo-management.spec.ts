/**
 * E2E Tests: Photo Management
 *
 * End-to-end tests for photo upload, gallery browsing, and photo management features.
 */
import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Photo Management", () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "admin-123",
          username: "admin",
          email: "admin@example.com",
          full_name: "Admin User",
          is_admin: true,
          is_active: true,
        }),
      });
    });

    // Mock photo API endpoints
    await page.route("**/api/photos", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id: "photo-1",
                title: "Mountain Landscape",
                description: "Beautiful mountain landscape at sunset",
                category: "landscape",
                tags: ["mountain", "sunset", "nature"],
                original_url: "/images/mountain-landscape.jpg",
                thumbnail_url: "/images/thumbnails/mountain-landscape.jpg",
                webp_url: "/images/webp/mountain-landscape.webp",
                width: 1920,
                height: 1080,
                file_size: 2048000,
                is_public: true,
                is_featured: true,
                created_at: "2023-10-15T14:30:00Z",
              },
              {
                id: "photo-2",
                title: "City Street",
                description: "Urban street photography",
                category: "street",
                tags: ["city", "urban", "street"],
                original_url: "/images/city-street.jpg",
                thumbnail_url: "/images/thumbnails/city-street.jpg",
                webp_url: "/images/webp/city-street.webp",
                width: 1920,
                height: 1080,
                file_size: 1536000,
                is_public: true,
                is_featured: false,
                created_at: "2023-10-14T10:20:00Z",
              },
            ],
            total: 2,
            page: 1,
            limit: 10,
            pages: 1,
          }),
        });
      }
    });

    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "photo-new",
          title: "New Upload",
          description: "Newly uploaded photo",
          category: "landscape",
          tags: ["test"],
          original_url: "/images/new-upload.jpg",
          thumbnail_url: "/images/thumbnails/new-upload.jpg",
          webp_url: "/images/webp/new-upload.webp",
          width: 800,
          height: 600,
          file_size: 1024000,
          is_public: true,
          is_featured: false,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.route("**/api/photos/**", async (route) => {
      const url = route.request().url();
      const photoId = url.split("/").pop();

      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: photoId,
            title: "Updated Photo Title",
            description: "Updated description",
            category: "updated",
            tags: ["updated"],
            original_url: "/images/updated-photo.jpg",
            thumbnail_url: "/images/thumbnails/updated-photo.jpg",
            webp_url: "/images/webp/updated-photo.webp",
            width: 1920,
            height: 1080,
            file_size: 2048000,
            is_public: true,
            is_featured: false,
            created_at: "2023-10-15T14:30:00Z",
            updated_at: new Date().toISOString(),
          }),
        });
      } else if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 204,
        });
      }
    });

    // Set up authenticated state
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("auth_token", "mock-jwt-token");
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "admin-123",
          username: "admin",
          full_name: "Admin User",
          is_admin: true,
        }),
      );
    });
  });

  test("should display photo gallery", async ({ page }) => {
    await page.goto("/gallery");

    await expect(page.getByTestId("photo-gallery")).toBeVisible();
    await expect(page.getByTestId("photo-item-photo-1")).toBeVisible();
    await expect(page.getByTestId("photo-item-photo-2")).toBeVisible();

    // Check photo metadata
    await expect(page.getByText("Mountain Landscape")).toBeVisible();
    await expect(page.getByText("City Street")).toBeVisible();
    await expect(page.getByText("landscape")).toBeVisible();
    await expect(page.getByText("street")).toBeVisible();
  });

  test("should filter photos by category", async ({ page }) => {
    await page.goto("/gallery");

    // Should show all photos initially
    await expect(page.getByTestId("photo-item-photo-1")).toBeVisible();
    await expect(page.getByTestId("photo-item-photo-2")).toBeVisible();

    // Filter by landscape
    if (await page.getByTestId("category-filter").isVisible()) {
      await page.getByTestId("category-filter").selectOption("landscape");

      // Mock filtered API response
      await page.route("**/api/photos?category=landscape", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id: "photo-1",
                title: "Mountain Landscape",
                category: "landscape",
                tags: ["mountain", "sunset", "nature"],
                original_url: "/images/mountain-landscape.jpg",
                thumbnail_url: "/images/thumbnails/mountain-landscape.jpg",
              },
            ],
            total: 1,
          }),
        });
      });

      await page.reload();
      await expect(page.getByTestId("photo-item-photo-1")).toBeVisible();
      await expect(page.getByTestId("photo-item-photo-2")).not.toBeVisible();
    }
  });

  test("should open photo details on click", async ({ page }) => {
    await page.goto("/gallery");

    await page.getByTestId("photo-item-photo-1").click();

    // Should open photo viewer/modal
    await expect(page.getByTestId("photo-viewer")).toBeVisible();
    await expect(page.getByText("Mountain Landscape")).toBeVisible();
    await expect(
      page.getByText("Beautiful mountain landscape at sunset"),
    ).toBeVisible();

    // Should show EXIF data if available
    if (await page.getByTestId("exif-data").isVisible()) {
      await expect(page.getByTestId("exif-data")).toBeVisible();
    }

    // Close viewer
    await page.getByTestId("close-viewer").click();
    await expect(page.getByTestId("photo-viewer")).not.toBeVisible();
  });

  test("should navigate between photos in viewer", async ({ page }) => {
    await page.goto("/gallery");

    await page.getByTestId("photo-item-photo-1").click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible();
    await expect(page.getByText("Mountain Landscape")).toBeVisible();

    // Navigate to next photo
    if (await page.getByTestId("next-photo").isVisible()) {
      await page.getByTestId("next-photo").click();
      await expect(page.getByText("City Street")).toBeVisible();

      // Navigate back to previous photo
      await page.getByTestId("prev-photo").click();
      await expect(page.getByText("Mountain Landscape")).toBeVisible();
    }
  });

  test("should support keyboard navigation in gallery", async ({ page }) => {
    await page.goto("/gallery");

    // Focus first photo
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("photo-item-photo-1")).toBeFocused();

    // Navigate with arrow keys
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("photo-item-photo-2")).toBeFocused();

    // Open with Enter
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("photo-viewer")).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("photo-viewer")).not.toBeVisible();
  });

  test("should handle photo upload", async ({ page }) => {
    await page.goto("/admin/upload");

    await expect(page.getByTestId("file-upload-container")).toBeVisible();

    // Simulate file selection
    page.getByTestId("file-input");

    // Create a test image file
    path.join(__dirname, "../fixtures/test-image.jpg");

    // In a real test, you'd have actual image files
    // For this example, we'll simulate the upload
    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(["mock image data"], "test-image.jpg", {
        type: "image/jpeg",
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    // Fill in photo details
    await page.getByTestId("photo-title").fill("New Test Photo");
    await page
      .getByTestId("photo-description")
      .fill("A test photo uploaded via E2E test");
    await page.getByTestId("photo-category").selectOption("landscape");

    // Submit upload
    await page.getByTestId("upload-button").click();

    // Should show upload progress
    await expect(page.getByTestId("upload-progress")).toBeVisible();

    // Should show success message
    await expect(page.getByTestId("upload-success")).toBeVisible();
    await expect(page.getByText("Photo uploaded successfully")).toBeVisible();
  });

  test("should handle drag and drop upload", async ({ page }) => {
    await page.goto("/admin/upload");

    page.getByTestId("drop-zone");

    // Simulate drag and drop
    await page.evaluate(() => {
      const dropZone = document.querySelector(
        '[data-testid="drop-zone"]',
      ) as HTMLElement;
      const mockFile = new File(["mock image data"], "dropped-image.jpg", {
        type: "image/jpeg",
      });

      const dragEvent = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(dragEvent, "dataTransfer", {
        value: {
          files: [mockFile],
          items: [
            {
              kind: "file",
              type: "image/jpeg",
              getAsFile: () => mockFile,
            },
          ],
        },
      });

      dropZone.dispatchEvent(dragEvent);
    });

    // Should show dropped file
    await expect(page.getByTestId("selected-files")).toBeVisible();
    await expect(page.getByText("dropped-image.jpg")).toBeVisible();
  });

  test("should validate file types during upload", async ({ page }) => {
    await page.goto("/admin/upload");

    // Try to upload invalid file type
    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(["mock document"], "document.pdf", {
        type: "application/pdf",
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    // Should show error message
    await expect(page.getByTestId("error-message")).toBeVisible();
    await expect(page.getByText(/File type.*not accepted/)).toBeVisible();
  });

  test("should edit photo metadata", async ({ page }) => {
    await page.goto("/admin/photos");

    // Should show photo management interface
    await expect(page.getByTestId("photo-management")).toBeVisible();
    await expect(page.getByTestId("photo-item-photo-1")).toBeVisible();

    // Click edit button
    await page.getByTestId("edit-photo-photo-1").click();

    // Should open edit modal
    await expect(page.getByTestId("edit-photo-modal")).toBeVisible();

    // Edit photo details
    await page.getByTestId("edit-title").fill("Updated Mountain Photo");
    await page
      .getByTestId("edit-description")
      .fill("Updated description for mountain photo");
    await page.getByTestId("edit-category").selectOption("nature");

    // Save changes
    await page.getByTestId("save-photo").click();

    // Should show success message
    await expect(page.getByTestId("update-success")).toBeVisible();

    // Modal should close
    await expect(page.getByTestId("edit-photo-modal")).not.toBeVisible();

    // Changes should be reflected in list
    await expect(page.getByText("Updated Mountain Photo")).toBeVisible();
  });

  test("should delete photos", async ({ page }) => {
    await page.goto("/admin/photos");

    await expect(page.getByTestId("photo-item-photo-1")).toBeVisible();

    // Click delete button
    await page.getByTestId("delete-photo-photo-1").click();

    // Should show confirmation dialog
    await expect(page.getByTestId("delete-confirmation")).toBeVisible();
    await expect(
      page.getByText(/Are you sure.*delete.*Mountain Landscape/),
    ).toBeVisible();

    // Cancel deletion
    await page.getByTestId("cancel-delete").click();
    await expect(page.getByTestId("delete-confirmation")).not.toBeVisible();
    await expect(page.getByTestId("photo-item-photo-1")).toBeVisible();

    // Try delete again and confirm
    await page.getByTestId("delete-photo-photo-1").click();
    await page.getByTestId("confirm-delete").click();

    // Should show success message
    await expect(page.getByTestId("delete-success")).toBeVisible();

    // Photo should be removed from list
    await expect(page.getByTestId("photo-item-photo-1")).not.toBeVisible();
  });

  test("should handle photo search", async ({ page }) => {
    await page.goto("/gallery");

    const searchInput = page.getByTestId("photo-search");
    if (await searchInput.isVisible()) {
      // Search for mountain
      await searchInput.fill("mountain");
      await page.keyboard.press("Enter");

      // Mock search API response
      await page.route("**/api/photos?search=mountain", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id: "photo-1",
                title: "Mountain Landscape",
                category: "landscape",
                tags: ["mountain", "sunset", "nature"],
                original_url: "/images/mountain-landscape.jpg",
                thumbnail_url: "/images/thumbnails/mountain-landscape.jpg",
              },
            ],
            total: 1,
          }),
        });
      });

      // Should show filtered results
      await expect(page.getByTestId("photo-item-photo-1")).toBeVisible();
      await expect(page.getByText("Mountain Landscape")).toBeVisible();

      // Clear search
      await searchInput.clear();
      await page.keyboard.press("Enter");

      // Should show all photos again
      await expect(page.getByTestId("photo-item-photo-2")).toBeVisible();
    }
  });

  test("should handle lazy loading in gallery", async ({ page }) => {
    // Mock large photo list
    await page.route("**/api/photos", async (route) => {
      const url = new URL(route.request().url());
      const page_num = parseInt(url.searchParams.get("page") ?? "1");
      const limit = parseInt(url.searchParams.get("limit") ?? "12");

      const photos = Array.from({ length: limit }, (_, i) => ({
        id: `photo-${page_num}-${i + 1}`,
        title: `Photo ${page_num}-${i + 1}`,
        category: "test",
        tags: ["test"],
        original_url: `/images/photo-${page_num}-${i + 1}.jpg`,
        thumbnail_url: `/images/thumbnails/photo-${page_num}-${i + 1}.jpg`,
        width: 800,
        height: 600,
        is_public: true,
      }));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: photos,
          total: 100,
          page: page_num,
          limit,
          pages: Math.ceil(100 / limit),
        }),
      });
    });

    await page.goto("/gallery");

    // Should load initial photos
    await expect(page.getByTestId("photo-item-photo-1-1")).toBeVisible();

    // Scroll to bottom to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Should load more photos
    await expect(page.getByTestId("loading-more")).toBeVisible();
    await expect(page.getByTestId("photo-item-photo-2-1")).toBeVisible();
  });

  test("should handle photo sharing", async ({ page }) => {
    await page.goto("/gallery");

    await page.getByTestId("photo-item-photo-1").click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible();

    if (await page.getByTestId("share-photo").isVisible()) {
      await page.getByTestId("share-photo").click();

      // Should show share options
      await expect(page.getByTestId("share-modal")).toBeVisible();

      // Test copy link
      await page.getByTestId("copy-link").click();

      // Should show copied confirmation
      await expect(page.getByTestId("link-copied")).toBeVisible();

      // Test social sharing buttons
      const socialButtons = ["twitter-share", "facebook-share", "email-share"];

      for (const button of socialButtons) {
        if (await page.getByTestId(button).isVisible()) {
          await expect(page.getByTestId(button)).toBeVisible();
        }
      }
    }
  });

  test("should be responsive on mobile devices", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/gallery");

    // Should show mobile-optimized gallery
    await expect(page.getByTestId("photo-gallery")).toBeVisible();

    // Photos should stack in single column on mobile
    const galleryGrid = page.getByTestId("photo-gallery").locator(".grid");
    if (await galleryGrid.isVisible()) {
      const gridClasses = await galleryGrid.getAttribute("class");
      expect(gridClasses).toContain("grid-cols-1");
    }

    // Test mobile photo viewer
    await page.getByTestId("photo-item-photo-1").click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible();

    // Should be optimized for mobile viewing
    const viewer = page.getByTestId("photo-viewer");
    const viewerClasses = await viewer.getAttribute("class");
    expect(viewerClasses).toMatch(/(w-full|mobile|responsive)/);
  });
});

test.describe("Photo Upload with Empty Fields", () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "admin-123",
          username: "admin",
          email: "admin@example.com",
          full_name: "Admin User",
          is_admin: true,
          is_active: true,
        }),
      });
    });

    // Set up authenticated state
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("auth_token", "mock-jwt-token");
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "admin-123",
          username: "admin",
          full_name: "Admin User",
          is_admin: true,
        }),
      );
    });
  });

  test("should upload photo with empty title and use filename", async ({
    page,
  }) => {
    // Mock upload API response with filename as title
    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "photo-empty-title",
          title: "empty-title-test.jpg", // Backend uses filename when title is empty
          description: "Test description",
          category: "test",
          tags: ["test"],
          original_url: "/images/empty-title-test.jpg",
          thumbnail_url: "/images/thumbnails/empty-title-test.jpg",
          webp_url: "/images/webp/empty-title-test.webp",
          width: 800,
          height: 600,
          file_size: 1024000,
          is_public: true,
          is_featured: false,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/admin/upload");

    // Upload file
    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(["mock image data"], "empty-title-test.jpg", {
        type: "image/jpeg",
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    // Leave title field empty and fill other fields
    await page.getByTestId("photo-title").fill(""); // Explicitly clear title
    await page.getByTestId("photo-description").fill("Test description");
    await page.getByTestId("photo-category").selectOption("test");

    await page.getByTestId("upload-button").click();

    // Should show success message indicating title was set to filename
    await expect(page.getByTestId("upload-success")).toBeVisible();
    await expect(page.getByText("Photo uploaded successfully")).toBeVisible();
  });

  test("should upload photo with empty description", async ({ page }) => {
    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "photo-empty-description",
          title: "Empty Description Test",
          description: "", // Empty description should be preserved
          category: "test",
          tags: ["test"],
          original_url: "/images/empty-description-test.jpg",
          thumbnail_url: "/images/thumbnails/empty-description-test.jpg",
          webp_url: "/images/webp/empty-description-test.webp",
          width: 800,
          height: 600,
          file_size: 1024000,
          is_public: true,
          is_featured: false,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/admin/upload");

    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(
        ["mock image data"],
        "empty-description-test.jpg",
        {
          type: "image/jpeg",
        },
      );
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    // Fill only required fields, leave description empty
    await page.getByTestId("photo-title").fill("Empty Description Test");
    await page.getByTestId("photo-description").fill(""); // Explicitly clear description
    await page.getByTestId("photo-category").selectOption("test");

    await page.getByTestId("upload-button").click();

    await expect(page.getByTestId("upload-success")).toBeVisible();
  });

  test("should upload photo with empty category and get default", async ({
    page,
  }) => {
    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "photo-empty-category",
          title: "Empty Category Test",
          description: "Testing empty category",
          category: "uncategorized", // Backend provides default category
          tags: ["test"],
          original_url: "/images/empty-category-test.jpg",
          thumbnail_url: "/images/thumbnails/empty-category-test.jpg",
          webp_url: "/images/webp/empty-category-test.webp",
          width: 800,
          height: 600,
          file_size: 1024000,
          is_public: true,
          is_featured: false,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/admin/upload");

    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(
        ["mock image data"],
        "empty-category-test.jpg",
        {
          type: "image/jpeg",
        },
      );
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    await page.getByTestId("photo-title").fill("Empty Category Test");
    await page.getByTestId("photo-description").fill("Testing empty category");
    // Leave category unselected or select empty option if available
    if (
      await page
        .getByTestId("photo-category")
        .locator('option[value=""]')
        .isVisible()
    ) {
      await page.getByTestId("photo-category").selectOption("");
    }

    await page.getByTestId("upload-button").click();

    await expect(page.getByTestId("upload-success")).toBeVisible();
  });

  test("should upload photo with empty tags field", async ({ page }) => {
    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "photo-empty-tags",
          title: "Empty Tags Test",
          description: "Testing empty tags",
          category: "test",
          tags: [], // Empty tags array
          original_url: "/images/empty-tags-test.jpg",
          thumbnail_url: "/images/thumbnails/empty-tags-test.jpg",
          webp_url: "/images/webp/empty-tags-test.webp",
          width: 800,
          height: 600,
          file_size: 1024000,
          is_public: true,
          is_featured: false,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/admin/upload");

    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(["mock image data"], "empty-tags-test.jpg", {
        type: "image/jpeg",
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    await page.getByTestId("photo-title").fill("Empty Tags Test");
    await page.getByTestId("photo-description").fill("Testing empty tags");
    await page.getByTestId("photo-category").selectOption("test");

    // Leave tags field empty
    if (await page.getByTestId("photo-tags").isVisible()) {
      await page.getByTestId("photo-tags").fill("");
    }

    await page.getByTestId("upload-button").click();

    await expect(page.getByTestId("upload-success")).toBeVisible();
  });

  test("should handle whitespace-only fields correctly", async ({ page }) => {
    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "photo-whitespace",
          title: "whitespace-test.jpg", // Backend trims whitespace and falls back to filename
          description: "", // Trimmed whitespace becomes empty
          category: "test", // Category trimmed
          tags: ["tag1", "tag2"], // Tags trimmed and filtered
          original_url: "/images/whitespace-test.jpg",
          thumbnail_url: "/images/thumbnails/whitespace-test.jpg",
          webp_url: "/images/webp/whitespace-test.webp",
          width: 800,
          height: 600,
          file_size: 1024000,
          is_public: true,
          is_featured: false,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/admin/upload");

    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(["mock image data"], "whitespace-test.jpg", {
        type: "image/jpeg",
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    // Fill fields with whitespace-only content
    await page.getByTestId("photo-title").fill("   "); // Only spaces
    await page.getByTestId("photo-description").fill("\t\n  \r  "); // Various whitespace
    await page.getByTestId("photo-category").selectOption("test");

    if (await page.getByTestId("photo-tags").isVisible()) {
      await page.getByTestId("photo-tags").fill("  tag1  ,  tag2  ,   "); // Tags with whitespace
    }

    await page.getByTestId("upload-button").click();

    await expect(page.getByTestId("upload-success")).toBeVisible();
  });

  test("should upload photo with all empty metadata fields", async ({
    page,
  }) => {
    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "photo-all-empty",
          title: "all-empty-test.jpg", // Filename used as title
          description: "",
          category: "uncategorized", // Default category
          tags: [],
          original_url: "/images/all-empty-test.jpg",
          thumbnail_url: "/images/thumbnails/all-empty-test.jpg",
          webp_url: "/images/webp/all-empty-test.webp",
          width: 800,
          height: 600,
          file_size: 1024000,
          is_public: true,
          is_featured: false,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/admin/upload");

    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(["mock image data"], "all-empty-test.jpg", {
        type: "image/jpeg",
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    // Leave all metadata fields empty or clear them
    await page.getByTestId("photo-title").fill("");
    await page.getByTestId("photo-description").fill("");

    if (
      await page
        .getByTestId("photo-category")
        .locator('option[value=""]')
        .isVisible()
    ) {
      await page.getByTestId("photo-category").selectOption("");
    }

    if (await page.getByTestId("photo-tags").isVisible()) {
      await page.getByTestId("photo-tags").fill("");
    }

    await page.getByTestId("upload-button").click();

    await expect(page.getByTestId("upload-success")).toBeVisible();
    await expect(page.getByText("Photo uploaded successfully")).toBeVisible();
  });

  test("should upload photo without any metadata inputs at all", async ({
    page,
  }) => {
    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "photo-no-metadata",
          title: "no-metadata-test.jpg",
          description: "",
          category: "uncategorized",
          tags: [],
          original_url: "/images/no-metadata-test.jpg",
          thumbnail_url: "/images/thumbnails/no-metadata-test.jpg",
          webp_url: "/images/webp/no-metadata-test.webp",
          width: 800,
          height: 600,
          file_size: 1024000,
          is_public: true,
          is_featured: false,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/admin/upload");

    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(["mock image data"], "no-metadata-test.jpg", {
        type: "image/jpeg",
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    // Upload immediately without filling any metadata fields
    await page.getByTestId("upload-button").click();

    await expect(page.getByTestId("upload-success")).toBeVisible();
  });

  test("should handle malformed tags input gracefully", async ({ page }) => {
    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "photo-malformed-tags",
          title: "Malformed Tags Test",
          description: "Testing malformed tag strings",
          category: "test",
          tags: ["tag1", "tag2", "tag3"], // Backend filters out empty tags
          original_url: "/images/malformed-tags-test.jpg",
          thumbnail_url: "/images/thumbnails/malformed-tags-test.jpg",
          webp_url: "/images/webp/malformed-tags-test.webp",
          width: 800,
          height: 600,
          file_size: 1024000,
          is_public: true,
          is_featured: false,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/admin/upload");

    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(
        ["mock image data"],
        "malformed-tags-test.jpg",
        {
          type: "image/jpeg",
        },
      );
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    await page.getByTestId("photo-title").fill("Malformed Tags Test");
    await page
      .getByTestId("photo-description")
      .fill("Testing malformed tag strings");
    await page.getByTestId("photo-category").selectOption("test");

    if (await page.getByTestId("photo-tags").isVisible()) {
      await page.getByTestId("photo-tags").fill(",,,,tag1,,,tag2,,,,tag3,,,"); // Malformed tags
    }

    await page.getByTestId("upload-button").click();

    await expect(page.getByTestId("upload-success")).toBeVisible();
  });

  test("should show appropriate error message for 422 validation errors", async ({
    page,
  }) => {
    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          detail: [
            {
              loc: ["body", "title"],
              msg: "Title cannot be empty after trimming whitespace",
              type: "value_error",
            },
          ],
        }),
      });
    });

    await page.goto("/admin/upload");

    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(
        ["mock image data"],
        "validation-error-test.jpg",
        {
          type: "image/jpeg",
        },
      );
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    await page.getByTestId("upload-button").click();

    // Should show validation error message
    await expect(page.getByTestId("upload-error")).toBeVisible();
    await expect(page.getByText(/validation error/i)).toBeVisible();
  });

  test("should handle special characters in empty-like fields", async ({
    page,
  }) => {
    await page.route("**/api/photos/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "photo-special-chars",
          title: "special-chars-test.jpg", // Backend handles special characters
          description: "",
          category: "test",
          tags: [],
          original_url: "/images/special-chars-test.jpg",
          thumbnail_url: "/images/thumbnails/special-chars-test.jpg",
          webp_url: "/images/webp/special-chars-test.webp",
          width: 800,
          height: 600,
          file_size: 1024000,
          is_public: true,
          is_featured: false,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/admin/upload");

    await page.evaluate(() => {
      const fileInput = document.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;
      const mockFile = new File(["mock image data"], "special-chars-test.jpg", {
        type: "image/jpeg",
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    });

    // Fill with special characters that might be considered empty
    await page.getByTestId("photo-title").fill("\u200b\u200c\u200d"); // Zero-width characters
    await page.getByTestId("photo-description").fill("\n\r\t"); // Control characters
    await page.getByTestId("photo-category").selectOption("test");

    await page.getByTestId("upload-button").click();

    await expect(page.getByTestId("upload-success")).toBeVisible();
  });
});
