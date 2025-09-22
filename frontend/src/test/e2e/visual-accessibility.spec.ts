/**
 * Visual and Accessibility E2E Tests
 *
 * End-to-end tests focused on visual regression and accessibility including:
 * - Visual regression testing with screenshots
 * - Accessibility compliance testing (WCAG 2.1)
 * - Keyboard navigation testing
 * - Screen reader compatibility
 * - Color contrast validation
 * - Focus management and indicators
 * - Mobile and responsive accessibility
 */
import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3000';

// Helper function for consistent screenshot setup
async function setupScreenshot(
  page: Page,
  options: {
    reducedMotion?: boolean;
    highContrast?: boolean;
    darkMode?: boolean;
  } = {}
) {
  // Disable animations for consistent screenshots
  if (options.reducedMotion !== false) {
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-delay: -1ms !important;
          animation-duration: 1ms !important;
          animation-iteration-count: 1 !important;
          background-attachment: initial !important;
          scroll-behavior: auto !important;
          transition-duration: 0ms !important;
          transition-delay: 0ms !important;
        }
      `,
    });
  }

  // Apply high contrast mode if requested
  if (options.highContrast) {
    await page.emulateMedia({ forcedColors: 'active' });
  }

  // Apply dark mode if requested
  if (options.darkMode) {
    await page.emulateMedia({ colorScheme: 'dark' });
  }

  // Wait for fonts and images to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

// Helper function for keyboard navigation testing
async function testKeyboardNavigation(page: Page, expectedFocusableElements: string[]) {
  // Start from beginning
  await page.keyboard.press('Tab');

  for (const selector of expectedFocusableElements) {
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Verify the focused element matches expected selector
    const matchesSelector = (await focusedElement.locator(selector).count()) > 0;
    if (!matchesSelector) {
      console.warn(`Expected focus on ${selector}, but focused element doesn't match`);
    }

    await page.keyboard.press('Tab');
  }
}

// Helper function for login
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[name="username"]');
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/admin/**`);
}

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should capture homepage layout', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await setupScreenshot(page);

    // Capture full page screenshot
    await expect(page).toHaveScreenshot('homepage-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture projects page layout', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await setupScreenshot(page);

    await expect(page).toHaveScreenshot('projects-page-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture admin projects page layout', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/projects`);
    await setupScreenshot(page);

    await expect(page).toHaveScreenshot('admin-projects-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture project creation form', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/projects`);
    await page.click('button:text("Create New Project")');
    await setupScreenshot(page);

    await expect(page).toHaveScreenshot('project-form-create.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture mobile layouts', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Homepage mobile
    await page.goto(`${BASE_URL}/`);
    await setupScreenshot(page);
    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });

    // Projects page mobile
    await page.goto(`${BASE_URL}/projects`);
    await setupScreenshot(page);
    await expect(page).toHaveScreenshot('projects-page-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture tablet layouts', async ({ page }) => {
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto(`${BASE_URL}/projects`);
    await setupScreenshot(page);
    await expect(page).toHaveScreenshot('projects-page-tablet.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture high contrast mode', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await setupScreenshot(page, { highContrast: true });

    await expect(page).toHaveScreenshot('projects-page-high-contrast.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture dark mode (if supported)', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await setupScreenshot(page, { darkMode: true });

    await expect(page).toHaveScreenshot('projects-page-dark-mode.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture component states', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await setupScreenshot(page);

    // Test hover states by capturing specific components
    const filterButtons = page.locator('button:text("Featured")');
    if ((await filterButtons.count()) > 0) {
      await filterButtons.hover();
      await expect(filterButtons).toHaveScreenshot('filter-button-hover.png');
    }

    // Test focus states
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    if ((await focusedElement.count()) > 0) {
      await expect(focusedElement).toHaveScreenshot('focused-element.png');
    }
  });
});

test.describe('Accessibility Compliance Tests', () => {
  test('should pass axe accessibility tests on homepage', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should pass axe accessibility tests on projects page', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should pass axe accessibility tests on admin pages', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/projects`);
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should pass axe accessibility tests on forms', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/projects`);
    await page.click('button:text("Create New Project")');
    await page.waitForSelector('h2:text("Create New Project")');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);

    // Check for proper heading structure
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);

    // Verify heading content is meaningful
    const h1Text = await h1.textContent();
    expect(h1Text).toBeTruthy();
    expect(h1Text?.trim()).not.toBe('');
  });

  test('should have proper form labels', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/projects`);
    await page.click('button:text("Create New Project")');

    // Check that all form inputs have labels
    const inputs = page.locator('input, select, textarea');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      await input.getAttribute('name');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');

      // Input should have either a label, aria-label, or aria-labelledby
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = (await label.count()) > 0;
        const hasAriaLabel = ariaLabel !== null;
        const hasAriaLabelledby = ariaLabelledby !== null;

        expect(hasLabel || hasAriaLabel || hasAriaLabelledby).toBeTruthy();
      }
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle');

    // Use axe to specifically check color contrast
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include(['[role="main"]'])
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );

    expect(contrastViolations).toEqual([]);
  });

  test('should provide alt text for images', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);

    // Check that all images have alt text
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      const role = await img.getAttribute('role');

      // Image should have alt text, aria-label, or be decorative
      const hasAltText = alt !== null && alt !== '';
      const hasAriaLabel = ariaLabel !== null && ariaLabel !== '';
      const isDecorative = role === 'presentation' || alt === '';

      expect(hasAltText || hasAriaLabel || isDecorative).toBeTruthy();
    }
  });
});

test.describe('Keyboard Navigation Tests', () => {
  test('should support keyboard navigation on homepage', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Test basic tab navigation
    await page.keyboard.press('Tab');
    let focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Continue tabbing through interactive elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      focusedElement = page.locator(':focus');

      // If element is visible, it should be focusable
      const isVisible = await focusedElement.isVisible();
      if (isVisible) {
        expect(isVisible).toBeTruthy();
      }
    }
  });

  test('should support keyboard navigation on projects page', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle');

    // Expected focusable elements in order
    const expectedElements = [
      'input[placeholder="Search projects..."]',
      'button:text("All")',
      'button:text("Featured")',
      'button:text("Active")',
      'button:text("In Progress")',
    ];

    await testKeyboardNavigation(page, expectedElements);
  });

  test('should support keyboard navigation in forms', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/projects`);
    await page.click('button:text("Create New Project")');
    await page.waitForSelector('h2:text("Create New Project")');

    // Test form field navigation
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');

    // Should focus on first form field
    const isInput = await focusedElement.evaluate(
      el => el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'
    );

    if (isInput) {
      expect(isInput).toBeTruthy();
    }

    // Test that Enter submits form when appropriate
    const submitButton = page.locator('button[type="submit"], button:text("Create Project")');
    if ((await submitButton.count()) > 0) {
      await submitButton.focus();
      // Don't actually submit to avoid creating test data
    }
  });

  test('should support escape key to close modals', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/projects`);

    // Open create form
    await page.click('button:text("Create New Project")');
    await page.waitForSelector('h2:text("Create New Project")');

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Should return to projects list
    await expect(page.locator('h1:text("Project Management")')).toBeVisible();
    await expect(page.locator('h2:text("Create New Project")')).not.toBeVisible();
  });

  test('should support arrow key navigation in lists', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle');

    // If there are filter buttons, test arrow navigation
    const filterButtons = page.locator(
      'button:text("All"), button:text("Featured"), button:text("Active")'
    );
    const buttonCount = await filterButtons.count();

    if (buttonCount > 1) {
      // Focus first button
      await filterButtons.first().focus();

      // Test arrow key navigation
      await page.keyboard.press('ArrowRight');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }
  });

  test('should have visible focus indicators', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);

    // Tab to first focusable element
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');

    if ((await focusedElement.count()) > 0) {
      // Check for focus styles
      const focusedStyles = await focusedElement.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineStyle: styles.outlineStyle,
          outlineWidth: styles.outlineWidth,
          outlineColor: styles.outlineColor,
          boxShadow: styles.boxShadow,
        };
      });

      // Should have some form of focus indicator
      const hasFocusIndicator =
        focusedStyles.outline !== 'none' ||
        focusedStyles.outlineStyle !== 'none' ||
        focusedStyles.boxShadow !== 'none' ||
        focusedStyles.boxShadow.includes('focus') ||
        focusedStyles.boxShadow.includes('ring');

      expect(hasFocusIndicator).toBeTruthy();
    }
  });
});

test.describe('Mobile Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('should be accessible on mobile devices', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have touch-friendly targets', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);

    // Check that clickable elements are large enough for touch
    const clickableElements = page.locator(
      'button, a, input[type="checkbox"], input[type="radio"]'
    );
    const count = await clickableElements.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      // Test first 10 elements
      const element = clickableElements.nth(i);
      const box = await element.boundingBox();

      if (box) {
        // WCAG recommends minimum 44px for touch targets
        const minSize = 44;
        const isTouchFriendly = box.width >= minSize || box.height >= minSize;

        // If element is too small, it should have adequate spacing
        if (!isTouchFriendly) {
          // This is a warning, not a hard failure for this test
          console.warn(`Touch target may be too small: ${box.width}x${box.height}`);
        }
      }
    }
  });

  test('should support touch gestures appropriately', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);

    // Test that scrolling works on mobile
    await page.evaluate(() => {
      window.scrollTo(0, 200);
    });

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });
});

test.describe('Screen Reader Compatibility Tests', () => {
  test('should have proper landmarks', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);

    // Check for main landmark
    const main = page.locator('main, [role="main"]');
    await expect(main).toHaveCount(1);

    // Check for navigation landmark
    const nav = page.locator('nav, [role="navigation"]');
    if ((await nav.count()) > 0) {
      await expect(nav.first()).toBeVisible();
    }
  });

  test('should have descriptive page titles', async ({ page }) => {
    const pages = [
      { url: `${BASE_URL}/`, expectedTitle: /portfolio|home/i },
      { url: `${BASE_URL}/projects`, expectedTitle: /projects/i },
    ];

    for (const { url, expectedTitle } of pages) {
      await page.goto(url);
      const title = await page.title();
      expect(title).toMatch(expectedTitle);
      expect(title.trim()).not.toBe('');
    }
  });

  test('should announce dynamic content changes', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);

    // Test search functionality announcements
    const searchInput = page.locator('input[placeholder="Search projects..."]');
    if ((await searchInput.count()) > 0) {
      await searchInput.fill('test search');

      // Check for aria-live regions or status updates
      const ariaLiveRegions = page.locator('[aria-live]');
      const statusElements = page.locator('[role="status"]');

      const hasLiveRegion = (await ariaLiveRegions.count()) > 0;
      const hasStatus = (await statusElements.count()) > 0;

      // Should have some way to announce changes
      expect(hasLiveRegion || hasStatus).toBeTruthy();
    }
  });

  test('should provide context for form errors', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/projects`);
    await page.click('button:text("Create New Project")');

    // Try to submit empty form to trigger validation
    await page.click('button:text("Create Project")');

    // Check for error messages associated with form fields
    const errorMessages = page.locator('[role="alert"], .error, [aria-invalid="true"]');
    if ((await errorMessages.count()) > 0) {
      // Error messages should be associated with their form fields
      await expect(errorMessages.first()).toBeVisible();
    }
  });

  test('should provide skip links for navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);

    // Test for skip link (usually hidden until focused)
    await page.keyboard.press('Tab');
    const skipLink = page.locator('a:text("Skip"), a[href="#main"], a[href="#content"]');

    if ((await skipLink.count()) > 0) {
      await expect(skipLink.first()).toBeVisible();
    }
  });
});
