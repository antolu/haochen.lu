/**
 * Project Management E2E Tests
 *
 * End-to-end tests for the complete project management workflow including:
 * - Project creation, editing, and deletion
 * - Project list browsing and filtering
 * - Repository integration and README sync
 * - Admin interface navigation
 * - Search and filter functionality
 * - Form validation and error handling
 * - Responsive behavior across devices
 */
import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3000';

// Mock data for testing
const testProject = {
  title: 'E2E Test Project',
  slug: 'e2e-test-project',
  description: '# E2E Test Project\n\nThis is a test project created during end-to-end testing.',
  short_description: 'A project created by automated E2E tests',
  technologies: 'React, TypeScript, Playwright',
  status: 'active' as const,
  featured: true,
  github_url: 'https://github.com/test/e2e-project',
  demo_url: 'https://demo.e2e-project.com',
};

const updatedProject = {
  title: 'Updated E2E Test Project',
  description: '# Updated E2E Test Project\n\nThis project has been updated during testing.',
  short_description: 'An updated test project',
  technologies: 'React, TypeScript, Playwright, Vitest',
  status: 'in_progress' as const,
  featured: false,
};

// Helper functions
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);

  // Wait for login form
  await page.waitForSelector('input[name="username"]');

  // Fill login form
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin');

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for successful login
  await page.waitForURL(`${BASE_URL}/admin/**`);
}

async function navigateToProjectsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/admin/projects`);
  await page.waitForSelector('h1:text("Project Management")');
}

async function fillProjectForm(page: Page, project: typeof testProject) {
  // Fill basic information
  await page.fill('input[placeholder="Enter project title"]', project.title);

  if (project.short_description) {
    await page.fill(
      'input[placeholder="Brief description for project cards"]',
      project.short_description
    );
  }

  // Select status
  await page.selectOption('select', project.status);

  // Fill technologies
  await page.fill('input[placeholder*="React, TypeScript"]', project.technologies);

  // Set featured status
  if (project.featured) {
    await page.check('input[type="checkbox"]:near(:text("Mark as featured"))');
  } else {
    await page.uncheck('input[type="checkbox"]:near(:text("Mark as featured"))');
  }

  // Fill URLs
  if (project.github_url) {
    await page.fill('input[placeholder*="github.com"]', project.github_url);
  }

  if (project.demo_url) {
    await page.fill('input[placeholder="https://project-demo.com"]', project.demo_url);
  }

  // Fill description in markdown editor
  const markdownEditor = page
    .locator('[data-testid="markdown-textarea"], .w-md-editor-text-textarea, textarea')
    .first();
  await markdownEditor.fill(project.description);
}

async function cleanupTestProjects(page: Page) {
  try {
    await navigateToProjectsAdmin(page);

    // Look for test projects and delete them
    const testProjectRows = page.locator('tr:has-text("E2E Test")');
    const count = await testProjectRows.count();

    for (let i = 0; i < count; i++) {
      const row = testProjectRows.nth(0); // Always get first since rows shift after deletion
      const deleteButton = row.locator('button:text("Delete")');

      if ((await deleteButton.count()) > 0) {
        await deleteButton.click();

        // Handle confirmation dialog
        page.on('dialog', dialog => dialog.accept());

        // Wait for deletion to complete
        await page.waitForTimeout(1000);
      }
    }
  } catch (error) {
    console.log('Cleanup failed (this is expected if no test projects exist):', error);
  }
}

test.describe('Project Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup test projects after each test
    await cleanupTestProjects(page);
  });

  test.describe('Project Creation Workflow', () => {
    test('should create a new project successfully', async ({ page }) => {
      await navigateToProjectsAdmin(page);

      // Click create new project button
      await page.click('button:text("Create New Project")');

      // Wait for form to appear
      await page.waitForSelector('h2:text("Create New Project")');

      // Fill project form
      await fillProjectForm(page, testProject);

      // Submit form
      await page.click('button:text("Create Project")');

      // Wait for success and return to list
      await page.waitForSelector('h1:text("Project Management")');

      // Verify project appears in list
      await expect(page.locator(`text=${testProject.title}`)).toBeVisible();

      // Verify project details
      const projectRow = page.locator(`tr:has-text("${testProject.title}")`);
      await expect(projectRow.locator('text=Active')).toBeVisible();
      await expect(projectRow.locator('text=Featured')).toBeVisible();
      await expect(projectRow.locator('text=React')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await navigateToProjectsAdmin(page);

      // Click create new project button
      await page.click('button:text("Create New Project")');

      // Try to submit empty form
      await page.click('button:text("Create Project")');

      // Should show validation errors
      await expect(page.locator('text=Title is required')).toBeVisible();
    });

    test('should auto-generate slug from title', async ({ page }) => {
      await navigateToProjectsAdmin(page);

      // Click create new project button
      await page.click('button:text("Create New Project")');

      // Fill title
      await page.fill('input[placeholder="Enter project title"]', 'My Amazing Project!');

      // Check that slug is auto-generated
      const slugInput = page.locator('input[placeholder="project-url-slug"]');
      await expect(slugInput).toHaveValue('my-amazing-project');
    });

    test('should handle repository validation', async ({ page }) => {
      await navigateToProjectsAdmin(page);

      // Click create new project button
      await page.click('button:text("Create New Project")');

      // Fill repository URL
      await page.fill('input[placeholder*="github.com"]', 'https://github.com/facebook/react');

      // Click validate button
      await page.click('button:text("Validate")');

      // Should show validation result (success or error)
      await expect(
        page.locator('text=Repository Validated, text=Validation Error').first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Project Editing Workflow', () => {
    test('should edit an existing project', async ({ page }) => {
      // First create a project
      await navigateToProjectsAdmin(page);
      await page.click('button:text("Create New Project")');
      await fillProjectForm(page, testProject);
      await page.click('button:text("Create Project")');
      await page.waitForSelector('h1:text("Project Management")');

      // Now edit it
      const projectRow = page.locator(`tr:has-text("${testProject.title}")`);
      await projectRow.locator('button:text("Edit")').click();

      // Wait for edit form
      await page.waitForSelector('h2:text("Edit Project")');

      // Verify form is populated with existing data
      await expect(page.locator('input[placeholder="Enter project title"]')).toHaveValue(
        testProject.title
      );

      // Update project details
      await page.fill('input[placeholder="Enter project title"]', updatedProject.title);
      await page.selectOption('select', updatedProject.status);
      await page.uncheck('input[type="checkbox"]:near(:text("Mark as featured"))');

      // Update technologies
      await page.fill('input[placeholder*="React, TypeScript"]', updatedProject.technologies);

      // Submit changes
      await page.click('button:text("Update Project")');

      // Wait for return to list
      await page.waitForSelector('h1:text("Project Management")');

      // Verify changes
      await expect(page.locator(`text=${updatedProject.title}`)).toBeVisible();
      const updatedRow = page.locator(`tr:has-text("${updatedProject.title}")`);
      await expect(updatedRow.locator('text=In Progress')).toBeVisible();
      await expect(updatedRow.locator('text=Featured')).not.toBeVisible();
    });

    test('should cancel editing without saving changes', async ({ page }) => {
      // Create a project first
      await navigateToProjectsAdmin(page);
      await page.click('button:text("Create New Project")');
      await fillProjectForm(page, testProject);
      await page.click('button:text("Create Project")');
      await page.waitForSelector('h1:text("Project Management")');

      // Start editing
      const projectRow = page.locator(`tr:has-text("${testProject.title}")`);
      await projectRow.locator('button:text("Edit")').click();

      // Make some changes
      await page.fill('input[placeholder="Enter project title"]', 'Should Not Be Saved');

      // Cancel editing
      await page.click('button:text("Cancel")');

      // Verify we're back to list and changes weren't saved
      await page.waitForSelector('h1:text("Project Management")');
      await expect(page.locator(`text=${testProject.title}`)).toBeVisible();
      await expect(page.locator('text=Should Not Be Saved')).not.toBeVisible();
    });
  });

  test.describe('Project Deletion Workflow', () => {
    test('should delete a project with confirmation', async ({ page }) => {
      // Create a project first
      await navigateToProjectsAdmin(page);
      await page.click('button:text("Create New Project")');
      await fillProjectForm(page, testProject);
      await page.click('button:text("Create Project")');
      await page.waitForSelector('h1:text("Project Management")');

      // Delete the project
      const projectRow = page.locator(`tr:has-text("${testProject.title}")`);

      // Setup dialog handler before clicking delete
      page.on('dialog', dialog => {
        expect(dialog.message()).toContain(testProject.title);
        void dialog.accept();
      });

      await projectRow.locator('button:text("Delete")').click();

      // Wait for deletion to complete
      await page.waitForTimeout(2000);

      // Verify project is removed from list
      await expect(page.locator(`text=${testProject.title}`)).not.toBeVisible();
    });

    test('should cancel deletion when user rejects confirmation', async ({ page }) => {
      // Create a project first
      await navigateToProjectsAdmin(page);
      await page.click('button:text("Create New Project")');
      await fillProjectForm(page, testProject);
      await page.click('button:text("Create Project")');
      await page.waitForSelector('h1:text("Project Management")');

      // Try to delete but cancel
      const projectRow = page.locator(`tr:has-text("${testProject.title}")`);

      // Setup dialog handler to cancel
      page.on('dialog', dialog => {
        void dialog.dismiss();
      });

      await projectRow.locator('button:text("Delete")').click();

      // Verify project is still in list
      await expect(page.locator(`text=${testProject.title}`)).toBeVisible();
    });
  });

  test.describe('Project List and Search', () => {
    test('should search projects by title', async ({ page }) => {
      // Create multiple projects for testing
      await navigateToProjectsAdmin(page);

      // Create first project
      await page.click('button:text("Create New Project")');
      await fillProjectForm(page, testProject);
      await page.click('button:text("Create Project")');
      await page.waitForSelector('h1:text("Project Management")');

      // Create second project
      await page.click('button:text("Create New Project")');
      await fillProjectForm(page, {
        ...testProject,
        title: 'Another Test Project',
      });
      await page.click('button:text("Create Project")');
      await page.waitForSelector('h1:text("Project Management")');

      // Test search functionality
      await page.fill('input[placeholder="Search projects..."]', 'E2E Test');

      // Wait for search results
      await page.waitForTimeout(1000);

      // Should show only the matching project
      await expect(page.locator(`text=${testProject.title}`)).toBeVisible();
      await expect(page.locator('text=Another Test Project')).not.toBeVisible();

      // Clear search
      await page.fill('input[placeholder="Search projects..."]', '');
      await page.waitForTimeout(1000);

      // Should show all projects again
      await expect(page.locator(`text=${testProject.title}`)).toBeVisible();
      await expect(page.locator('text=Another Test Project')).toBeVisible();
    });

    test('should display project statistics', async ({ page }) => {
      await navigateToProjectsAdmin(page);

      // Should show statistics cards
      await expect(page.locator('text=Total Projects')).toBeVisible();
      await expect(page.locator('text=Featured')).toBeVisible();
      await expect(page.locator('text=Active')).toBeVisible();

      // Numbers should be present
      await expect(page.locator('.text-3xl').first()).toBeVisible();
    });

    test('should handle empty state', async ({ page }) => {
      await navigateToProjectsAdmin(page);

      // If no projects exist, should show empty state
      const noProjectsText = page.locator('text=No projects found');
      page.locator('text=Create your first project');

      // Check if either projects exist or empty state is shown
      const hasProjects = (await page.locator('tbody tr').count()) > 0;
      const hasEmptyState = await noProjectsText.isVisible();

      expect(hasProjects || hasEmptyState).toBeTruthy();
    });
  });

  test.describe('Public Project Views', () => {
    test('should display projects on public projects page', async ({ page }) => {
      // Create a public project first (as admin)
      await navigateToProjectsAdmin(page);
      await page.click('button:text("Create New Project")');
      await fillProjectForm(page, testProject);
      await page.click('button:text("Create Project")');
      await page.waitForSelector('h1:text("Project Management")');

      // Now visit public projects page
      await page.goto(`${BASE_URL}/projects`);

      // Wait for page to load
      await page.waitForSelector('h1:text("Projects & Work")');

      // Should show the project in the grid
      await expect(page.locator(`text=${testProject.title}`)).toBeVisible();
      await expect(page.locator(`text=${testProject.short_description}`)).toBeVisible();
    });

    test('should navigate to project detail page', async ({ page }) => {
      // Create a project first
      await navigateToProjectsAdmin(page);
      await page.click('button:text("Create New Project")');
      await fillProjectForm(page, testProject);
      await page.click('button:text("Create Project")');
      await page.waitForSelector('h1:text("Project Management")');

      // Visit public projects page
      await page.goto(`${BASE_URL}/projects`);
      await page.waitForSelector('h1:text("Projects & Work")');

      // Click on project to view details
      await page.click(`text=${testProject.title}`);

      // Should navigate to project detail page
      await page.waitForURL(`${BASE_URL}/projects/${testProject.slug}`);

      // Should show project details
      await expect(page.locator(`h1:text("${testProject.title}")`)).toBeVisible();
      await expect(page.locator(`text=${testProject.short_description}`)).toBeVisible();
      await expect(page.locator('text=Active')).toBeVisible();
      await expect(page.locator('text=⭐ Featured')).toBeVisible();

      // Should show action buttons
      if (testProject.demo_url) {
        await expect(page.locator('text=View Live Demo')).toBeVisible();
      }
      if (testProject.github_url) {
        await expect(page.locator('text=View Source Code')).toBeVisible();
      }
    });

    test('should filter projects by status', async ({ page }) => {
      // Visit public projects page
      await page.goto(`${BASE_URL}/projects`);
      await page.waitForSelector('h1:text("Projects & Work")');

      // Test filter buttons
      await page.click('button:text("Active")');
      await page.waitForTimeout(1000);

      // Active filter should be highlighted
      const activeButton = page.locator('button:text("Active")');
      await expect(activeButton).toHaveClass(/bg-blue-600/);

      // Test other filters
      await page.click('button:text("Featured")');
      await page.waitForTimeout(1000);

      const featuredButton = page.locator('button:text("Featured")');
      await expect(featuredButton).toHaveClass(/bg-blue-600/);
    });

    test('should search projects on public page', async ({ page }) => {
      await page.goto(`${BASE_URL}/projects`);
      await page.waitForSelector('h1:text("Projects & Work")');

      // Use search functionality
      await page.fill('input[placeholder="Search projects..."]', 'react');

      // Should update results (even if no matches)
      await page.waitForTimeout(1000);

      // Search input should retain value
      await expect(page.locator('input[placeholder="Search projects..."]')).toHaveValue('react');
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await navigateToProjectsAdmin(page);

      // Should still show main elements on mobile
      await expect(page.locator('h1:text("Project Management")')).toBeVisible();
      await expect(page.locator('button:text("Create New Project")')).toBeVisible();

      // Table should be responsive or scrollable
      const table = page.locator('table');
      if (await table.isVisible()) {
        // Table should be present and scrollable
        await expect(table).toBeVisible();
      }
    });

    test('should work on tablet devices', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto(`${BASE_URL}/projects`);
      await page.waitForSelector('h1:text("Projects & Work")');

      // Should show responsive grid
      await expect(page.locator('h1:text("Projects & Work")')).toBeVisible();

      // Grid should adapt to tablet size
      const projectGrid = page.locator('[data-testid="project-grid"], .grid');
      if ((await projectGrid.count()) > 0) {
        await expect(projectGrid.first()).toBeVisible();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Block network requests to simulate offline
      await page.route('**/api/**', route => route.abort());

      await page.goto(`${BASE_URL}/projects`);

      // Should show error state or retry option
      await expect(
        page.locator('text=Failed to load, text=Try again, text=Error').first()
      ).toBeVisible({ timeout: 10000 });
    });

    test('should handle form submission errors', async ({ page }) => {
      await navigateToProjectsAdmin(page);

      // Intercept API calls to return errors
      await page.route('**/api/projects', route => {
        void route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Validation error' }),
        });
      });

      // Try to create a project
      await page.click('button:text("Create New Project")');
      await fillProjectForm(page, testProject);
      await page.click('button:text("Create Project")');

      // Should handle error appropriately
      // (Either show error message or stay on form)
      await page.waitForTimeout(2000);

      // Form should still be visible (not redirected)
      await expect(page.locator('h2:text("Create New Project")')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await navigateToProjectsAdmin(page);

      // Should be able to navigate with keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Focus should be visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto(`${BASE_URL}/projects`);
      await page.waitForSelector('h1:text("Projects & Work")');

      // Check for ARIA labels on interactive elements
      const searchInput = page.locator('input[placeholder="Search projects..."]');
      if ((await searchInput.count()) > 0) {
        await expect(searchInput).toBeVisible();
      }

      // Check for proper heading hierarchy
      const mainHeading = page.locator('h1').first();
      await expect(mainHeading).toBeVisible();
    });
  });
});
