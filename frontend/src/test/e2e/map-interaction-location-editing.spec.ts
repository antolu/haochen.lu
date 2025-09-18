import { test, expect, Page } from '@playwright/test';

test.describe('Map Interaction and Location Editing', () => {
  // Test data setup
  const mockPhotoWithLocation = {
    id: '1',
    title: 'Golden Gate Bridge',
    location_lat: 37.8199,
    location_lon: -122.4783,
    location_name: 'Golden Gate Bridge, San Francisco, CA',
    camera_make: 'Canon',
    camera_model: 'EOS R5',
    date_taken: '2023-12-25T14:30:00Z',
    variants: {
      thumbnail: {
        path: '/compressed/bridge_thumb.webp',
        width: 400,
        height: 300,
      },
    },
  };

  const mockPhotosWithLocation = [
    mockPhotoWithLocation,
    {
      id: '2',
      title: 'NYC Skyline',
      location_lat: 40.7128,
      location_lon: -74.006,
      location_name: 'New York City, NY',
      variants: {
        thumbnail: {
          path: '/compressed/nyc_thumb.webp',
          width: 400,
          height: 300,
        },
      },
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('/api/photos*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPhotosWithLocation),
      });
    });

    await page.route('/api/locations/search*', async route => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q');

      const mockResults = query?.toLowerCase().includes('san francisco')
        ? [
            {
              latitude: 37.7749,
              longitude: -122.4194,
              location_name: 'San Francisco, California, United States',
              location_address: 'San Francisco, CA, USA',
            },
          ]
        : [
            {
              latitude: 40.7128,
              longitude: -74.006,
              location_name: 'New York City, New York, United States',
              location_address: 'New York, NY, USA',
            },
          ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResults),
      });
    });

    await page.route('/api/locations/reverse*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          location_name: 'Reverse Geocoded Location',
          location_address: 'Reverse Geocoded Address',
        }),
      });
    });

    // Login as admin
    await page.goto('/admin/login');
    await page.fill('[data-testid="username"]', 'admin');
    await page.fill('[data-testid="password"]', 'admin');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/admin');
  });

  test.describe('Photo Map View', () => {
    test('displays photos on map with correct markers', async ({ page }) => {
      await page.goto('/admin/photos');

      // Switch to map view if needed
      const mapViewButton = page.locator('[data-testid="map-view-toggle"]');
      if (await mapViewButton.isVisible()) {
        await mapViewButton.click();
      }

      // Wait for map to load
      await expect(page.locator('.leaflet-container')).toBeVisible();

      // Verify photo markers are displayed
      const markers = page.locator('.leaflet-marker-icon');
      await expect(markers).toHaveCount(2);

      // Click on first marker to open popup
      await markers.first().click();

      // Verify popup content
      await expect(page.locator('.leaflet-popup-content')).toBeVisible();
      await expect(page.locator('.leaflet-popup-content')).toContainText('Golden Gate Bridge');
      await expect(page.locator('.leaflet-popup-content')).toContainText('Canon EOS R5');
    });

    test('handles map zoom and pan interactions', async ({ page }) => {
      await page.goto('/admin/photos');

      const mapViewButton = page.locator('[data-testid="map-view-toggle"]');
      if (await mapViewButton.isVisible()) {
        await mapViewButton.click();
      }

      const mapContainer = page.locator('.leaflet-container');
      await expect(mapContainer).toBeVisible();

      // Test zoom controls
      const zoomInButton = page.locator('.leaflet-control-zoom-in');
      const zoomOutButton = page.locator('.leaflet-control-zoom-out');

      await zoomInButton.click();
      await page.waitForTimeout(500); // Wait for zoom animation

      await zoomOutButton.click();
      await page.waitForTimeout(500);

      // Test map panning by dragging
      const mapBounds = await mapContainer.boundingBox();
      if (mapBounds) {
        await page.mouse.move(
          mapBounds.x + mapBounds.width / 2,
          mapBounds.y + mapBounds.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(
          mapBounds.x + mapBounds.width / 2 + 100,
          mapBounds.y + mapBounds.height / 2 + 50
        );
        await page.mouse.up();
      }

      // Map should still be visible and functional
      await expect(mapContainer).toBeVisible();
    });
  });

  test.describe('Photo Edit Form Location Tab', () => {
    test('allows editing location through map picker', async ({ page }) => {
      await page.goto('/admin/photos');

      // Click edit button for first photo
      await page.click('[data-testid="edit-photo-1"]');

      // Switch to Location tab
      await page.click('[data-testid="location-tab"]');

      // Verify location inputs are populated
      await expect(page.locator('[data-testid="location-name-input"]')).toHaveValue(
        'Golden Gate Bridge, San Francisco, CA'
      );
      await expect(page.locator('[data-testid="latitude-input"]')).toHaveValue('37.8199');
      await expect(page.locator('[data-testid="longitude-input"]')).toHaveValue('-122.4783');

      // Open map picker
      await page.click('[data-testid="map-picker-toggle"]');

      // Wait for map to load
      await expect(page.locator('[data-testid="map-picker"] .leaflet-container')).toBeVisible();

      // Click on a different location on the map
      const mapContainer = page.locator('[data-testid="map-picker"] .leaflet-container');
      const mapBounds = await mapContainer.boundingBox();

      if (mapBounds) {
        // Click slightly offset from center to simulate selecting a new location
        await page.mouse.click(
          mapBounds.x + mapBounds.width / 2 + 50,
          mapBounds.y + mapBounds.height / 2 + 30
        );
      }

      // Verify coordinates were updated (mocked reverse geocoding will provide new location)
      await expect(page.locator('[data-testid="location-name-input"]')).toHaveValue(
        'Reverse Geocoded Location'
      );

      // Save the changes
      await page.click('[data-testid="save-photo-button"]');

      // Verify success message or navigation
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });

    test('allows manual coordinate entry', async ({ page }) => {
      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');

      // Clear existing coordinates and enter new ones
      await page.fill('[data-testid="latitude-input"]', '40.7589');
      await page.fill('[data-testid="longitude-input"]', '-73.9851');

      // The location should be reverse geocoded automatically
      await page.waitForTimeout(1000); // Wait for debounced geocoding

      // Verify location name was updated
      await expect(page.locator('[data-testid="location-name-input"]')).toHaveValue(
        'Reverse Geocoded Location'
      );

      // Save changes
      await page.click('[data-testid="save-photo-button"]');
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });

    test('handles current location request', async ({ page }) => {
      // Mock geolocation API
      await page.addInitScript(() => {
        navigator.geolocation = {
          getCurrentPosition: success => {
            success({
              coords: {
                latitude: 37.7749,
                longitude: -122.4194,
              },
            });
          },
        } as any;
      });

      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');

      // Click "Use Current Location" button
      await page.click('[data-testid="current-location-button"]');

      // Verify coordinates were updated
      await expect(page.locator('[data-testid="latitude-input"]')).toHaveValue('37.7749');
      await expect(page.locator('[data-testid="longitude-input"]')).toHaveValue('-122.4194');
    });

    test('validates coordinate ranges', async ({ page }) => {
      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');

      // Enter invalid coordinates
      await page.fill('[data-testid="latitude-input"]', '91'); // Invalid latitude
      await page.fill('[data-testid="longitude-input"]', '181'); // Invalid longitude

      // Try to save
      await page.click('[data-testid="save-photo-button"]');

      // Should show validation errors
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-error"]')).toContainText(
        'Invalid coordinates'
      );
    });
  });

  test.describe('Location Search and Selection', () => {
    test('searches and selects locations from dropdown', async ({ page }) => {
      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');
      await page.click('[data-testid="map-picker-toggle"]');

      // Use location search
      const searchInput = page.locator('[data-testid="location-search-input"]');
      await searchInput.fill('San Francisco');

      // Wait for search results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-result-item"]')).toHaveCount(1);

      // Click on search result
      await page.click('[data-testid="search-result-item"]');

      // Verify location was selected
      await expect(page.locator('[data-testid="location-name-input"]')).toHaveValue(
        'San Francisco, California, United States'
      );
      await expect(page.locator('[data-testid="latitude-input"]')).toHaveValue('37.7749');
      await expect(page.locator('[data-testid="longitude-input"]')).toHaveValue('-122.4194');

      // Search results should be hidden
      await expect(page.locator('[data-testid="search-results"]')).not.toBeVisible();
    });

    test('debounces search input to avoid excessive API calls', async ({ page }) => {
      let searchCallCount = 0;

      // Count search API calls
      await page.route('/api/locations/search*', async route => {
        searchCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');
      await page.click('[data-testid="map-picker-toggle"]');

      const searchInput = page.locator('[data-testid="location-search-input"]');

      // Type quickly (should be debounced)
      await searchInput.type('New');
      await searchInput.type(' York');
      await searchInput.type(' City');

      // Wait for debounce period
      await page.waitForTimeout(500);

      // Should have made only one API call after debouncing
      expect(searchCallCount).toBeLessThanOrEqual(2); // Allow some margin for implementation details
    });

    test('closes search dropdown when clicking outside', async ({ page }) => {
      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');
      await page.click('[data-testid="map-picker-toggle"]');

      // Open search results
      await page.fill('[data-testid="location-search-input"]', 'test');
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

      // Click outside the search area
      await page.click('[data-testid="map-picker"]');

      // Search results should be hidden
      await expect(page.locator('[data-testid="search-results"]')).not.toBeVisible();
    });
  });

  test.describe('Photo Metadata Overlay with Location', () => {
    test('shows location information in metadata overlay', async ({ page }) => {
      await page.goto('/admin/photos');

      // Enable metadata view
      const metadataToggle = page.locator('[data-testid="show-metadata-toggle"]');
      if (await metadataToggle.isVisible()) {
        await metadataToggle.check();
      }

      const firstPhotoCard = page.locator('[data-testid="photo-card-1"]');

      // Hover to show metadata overlay
      await firstPhotoCard.hover();

      // Wait for overlay animation
      await page.waitForTimeout(300);

      // Verify location information is displayed
      const metadataOverlay = firstPhotoCard.locator('[data-testid="metadata-overlay"]');
      await expect(metadataOverlay).toBeVisible();
      await expect(metadataOverlay).toContainText('📍 Golden Gate Bridge, San Francisco, CA');
      await expect(metadataOverlay).toContainText('📷 Canon EOS R5');
      await expect(metadataOverlay).toContainText('📅');
    });

    test('truncates long location names appropriately', async ({ page }) => {
      // Mock a photo with very long location name
      await page.route('/api/photos*', async route => {
        const photoWithLongLocation = {
          ...mockPhotoWithLocation,
          location_name:
            'This is an extremely long location name that should be truncated when displayed in the metadata overlay to prevent layout issues',
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([photoWithLongLocation]),
        });
      });

      await page.goto('/admin/photos');

      const metadataToggle = page.locator('[data-testid="show-metadata-toggle"]');
      if (await metadataToggle.isVisible()) {
        await metadataToggle.check();
      }

      const photoCard = page.locator('[data-testid="photo-card-1"]');
      await photoCard.hover();

      const locationText = photoCard.locator('[data-testid="location-text"]');
      await expect(locationText).toBeVisible();
      await expect(locationText).toHaveClass(/truncate/);
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('handles location service errors gracefully', async ({ page }) => {
      // Mock location service to return error
      await page.route('/api/locations/reverse*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Location service unavailable' }),
        });
      });

      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');

      // Manual coordinate entry should still work
      await page.fill('[data-testid="latitude-input"]', '40.7589');
      await page.fill('[data-testid="longitude-input"]', '-73.9851');

      // Should not show location name (since reverse geocoding failed)
      await expect(page.locator('[data-testid="location-name-input"]')).toHaveValue('');

      // But coordinates should be preserved
      await expect(page.locator('[data-testid="latitude-input"]')).toHaveValue('40.7589');
      await expect(page.locator('[data-testid="longitude-input"]')).toHaveValue('-73.9851');
    });

    test('handles map loading failures', async ({ page }) => {
      // Mock map tile requests to fail
      await page.route('https://**/*.tile.openstreetmap.org/**', async route => {
        await route.abort();
      });

      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');
      await page.click('[data-testid="map-picker-toggle"]');

      // Map container should still be visible even if tiles fail to load
      await expect(page.locator('[data-testid="map-picker"] .leaflet-container')).toBeVisible();

      // Alternative input methods should still work
      await page.fill('[data-testid="latitude-input"]', '37.7749');
      await page.fill('[data-testid="longitude-input"]', '-122.4194');

      await expect(page.locator('[data-testid="latitude-input"]')).toHaveValue('37.7749');
    });

    test('handles geolocation permission denied', async ({ page }) => {
      // Mock geolocation to fail
      await page.addInitScript(() => {
        navigator.geolocation = {
          getCurrentPosition: (success, error) => {
            error({ code: 1, message: 'Permission denied' });
          },
        } as any;
      });

      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');

      // Try to use current location
      await page.click('[data-testid="current-location-button"]');

      // Should show error message
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('Unable to get your current location');
        await dialog.accept();
      });

      // Form should remain functional
      await expect(page.locator('[data-testid="latitude-input"]')).toBeEditable();
      await expect(page.locator('[data-testid="longitude-input"]')).toBeEditable();
    });
  });

  test.describe('Accessibility and Keyboard Navigation', () => {
    test('supports keyboard navigation in location search', async ({ page }) => {
      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');
      await page.click('[data-testid="map-picker-toggle"]');

      const searchInput = page.locator('[data-testid="location-search-input"]');
      await searchInput.fill('San Francisco');

      // Wait for results
      await expect(page.locator('[data-testid="search-result-item"]')).toBeVisible();

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');

      // First result should be focused
      const firstResult = page.locator('[data-testid="search-result-item"]').first();
      await expect(firstResult).toBeFocused();

      // Select with Enter
      await page.keyboard.press('Enter');

      // Location should be selected
      await expect(page.locator('[data-testid="location-name-input"]')).toHaveValue(
        'San Francisco, California, United States'
      );
    });

    test('provides proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');

      // Check form labels
      await expect(page.locator('label[for="location-name"]')).toContainText('Location Name');
      await expect(page.locator('label[for="latitude"]')).toContainText('Latitude');
      await expect(page.locator('label[for="longitude"]')).toContainText('Longitude');

      // Check input accessibility attributes
      const latInput = page.locator('[data-testid="latitude-input"]');
      await expect(latInput).toHaveAttribute('aria-label', 'Latitude coordinate');

      const mapToggle = page.locator('[data-testid="map-picker-toggle"]');
      await expect(mapToggle).toHaveAttribute('aria-expanded', 'false');

      await mapToggle.click();
      await expect(mapToggle).toHaveAttribute('aria-expanded', 'true');
    });

    test('announces map interactions to screen readers', async ({ page }) => {
      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');
      await page.click('[data-testid="map-picker-toggle"]');

      const mapContainer = page.locator('[data-testid="map-picker"] .leaflet-container');

      // Map should have appropriate ARIA attributes
      await expect(mapContainer).toHaveAttribute('role', 'application');
      await expect(mapContainer).toHaveAttribute(
        'aria-label',
        'Interactive map for location selection'
      );

      // Status messages should be announced
      const statusRegion = page.locator('[aria-live="polite"]');
      await expect(statusRegion).toBeVisible();
    });
  });

  test.describe('Performance and Responsiveness', () => {
    test('loads map components efficiently', async ({ page }) => {
      await page.goto('/admin/photos');

      // Measure time to load photos with mini maps
      const startTime = Date.now();

      await expect(page.locator('[data-testid="mini-map"]').first()).toBeVisible();

      const loadTime = Date.now() - startTime;

      // Should load reasonably quickly (adjust threshold as needed)
      expect(loadTime).toBeLessThan(3000); // 3 seconds
    });

    test('handles responsive layout changes', async ({ page }) => {
      await page.goto('/admin/photos');

      // Test desktop layout
      await page.setViewportSize({ width: 1200, height: 800 });
      await expect(page.locator('[data-testid="mini-map"]')).toBeVisible();

      // Test tablet layout
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('[data-testid="mini-map"]')).toBeVisible();

      // Test mobile layout
      await page.setViewportSize({ width: 375, height: 667 });

      // Mini maps might be hidden or smaller on mobile
      const miniMaps = page.locator('[data-testid="mini-map"]');
      const isVisible = await miniMaps.first().isVisible();

      // Either visible (with responsive sizing) or hidden for mobile optimization
      if (isVisible) {
        const miniMapSize = await miniMaps.first().boundingBox();
        expect(miniMapSize?.width).toBeLessThanOrEqual(60); // Should be small on mobile
      }
    });

    test('debounces coordinate input changes', async ({ page }) => {
      let geocodeCallCount = 0;

      await page.route('/api/locations/reverse*', async route => {
        geocodeCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ location_name: 'Test Location' }),
        });
      });

      await page.goto('/admin/photos');
      await page.click('[data-testid="edit-photo-1"]');
      await page.click('[data-testid="location-tab"]');

      const latInput = page.locator('[data-testid="latitude-input"]');

      // Clear and type quickly
      await latInput.clear();
      await latInput.type('40.7128', { delay: 50 });

      // Wait for debounce
      await page.waitForTimeout(1000);

      // Should have made only one geocoding call after debouncing
      expect(geocodeCallCount).toBeLessThanOrEqual(2);
    });
  });
});
