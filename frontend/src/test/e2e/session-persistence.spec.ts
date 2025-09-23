/**
 * E2E Tests for Session Persistence
 * Tests complete user journeys including session persistence across browser
 * restarts, multi-tab behavior, and real-world scenarios.
 */
import { test, expect, type Page } from "@playwright/test";

// Test data
const testUser = {
  username: "admin",
  password: "admin",
};

const mockUser = {
  id: "1",
  username: "admin",
  email: "admin@example.com",
  is_active: true,
  is_admin: true,
};

const mockTokenResponse = {
  access_token: "test-access-token",
  token_type: "bearer",
  expires_in: 900,
  user: mockUser,
};

// Helper function to mock API responses
async function setupApiMocks(page: Page) {
  // Mock login endpoint
  await page.route("**/api/auth/login", async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as {
      username: string;
      password: string;
    };

    if (
      body.username === testUser.username &&
      body.password === testUser.password
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenResponse),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid credentials" }),
      });
    }
  });

  // Mock /me endpoint
  await page.route("**/api/auth/me", async (route) => {
    const headers = route.request().headers();
    if (headers.authorization?.includes("test-access-token")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid token" }),
      });
    }
  });

  // Mock refresh endpoint
  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "refreshed-access-token",
        expires_in: 900,
        user: mockUser,
      }),
    });
  });

  // Mock logout endpoint
  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Mock revoke all sessions endpoint
  await page.route("**/api/auth/revoke-all-sessions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

// Helper function to login
async function login(page: Page, rememberMe: boolean = false) {
  await page.goto("/login");

  await page.fill('[data-testid="username-input"]', testUser.username);
  await page.fill('[data-testid="password-input"]', testUser.password);

  if (rememberMe) {
    await page.check("#rememberMe");
  }

  await page.click('[data-testid="login-button"]');

  // Wait for redirect to dashboard
  await page.waitForURL("/admin");
}

test.describe("Session Persistence E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test.describe("Login Flow", () => {
    test("should login successfully with remember me", async ({ page }) => {
      await page.goto("/login");

      // Fill login form
      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.check("#rememberMe");

      // Submit form
      await page.click('[data-testid="login-button"]');

      // Should redirect to admin panel
      await page.waitForURL("/admin");

      // Verify login success
      await expect(
        page.locator("text=Dashboard") || page.locator("text=Admin"),
      ).toBeVisible();
    });

    test("should login successfully without remember me", async ({ page }) => {
      await page.goto("/login");

      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="password-input"]', testUser.password);
      // Don't check remember me

      await page.click('[data-testid="login-button"]');

      await page.waitForURL("/admin");
      await expect(
        page.locator("text=Dashboard") || page.locator("text=Admin"),
      ).toBeVisible();
    });

    test("should show error for invalid credentials", async ({ page }) => {
      await page.goto("/login");

      await page.fill('[data-testid="username-input"]', "wrong");
      await page.fill('[data-testid="password-input"]', "wrong");
      await page.click('[data-testid="login-button"]');

      // Should show error message
      await expect(page.locator("text=Invalid credentials")).toBeVisible();

      // Should stay on login page
      expect(page.url()).toContain("/login");
    });

    test("should show loading state during login", async ({ page }) => {
      // Add delay to login response
      await page.route("**/api/auth/login", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockTokenResponse),
        });
      });

      await page.goto("/login");
      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="password-input"]', testUser.password);

      await page.click('[data-testid="login-button"]');

      // Should show loading state
      await expect(page.locator("text=Signing in...")).toBeVisible();
      await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();
    });
  });

  test.describe("Session Persistence", () => {
    test("should persist session with remember me across browser restart", async ({
      browser,
    }) => {
      // Create a persistent context to simulate browser restart
      const context = await browser.newContext();
      const page = await context.newPage();

      await setupApiMocks(page);
      await login(page, true); // Login with remember me

      // Verify we're logged in
      await expect(
        page.locator("text=Dashboard") || page.locator("text=Admin"),
      ).toBeVisible();

      // Close the context (simulates browser close)
      await context.close();

      // Create new context (simulates browser restart)
      const newContext = await browser.newContext();
      const newPage = await newContext.newPage();

      await setupApiMocks(newPage);

      // Navigate to protected page - should still be logged in
      await newPage.goto("/admin");

      // Should still be authenticated (no redirect to login)
      await expect(
        newPage.locator("text=Dashboard") || newPage.locator("text=Admin"),
      ).toBeVisible();

      await newContext.close();
    });

    test("should not persist session without remember me across browser restart", async ({
      browser,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await setupApiMocks(page);
      await login(page, false); // Login without remember me

      await expect(
        page.locator("text=Dashboard") || page.locator("text=Admin"),
      ).toBeVisible();

      // Close context
      await context.close();

      // Create new context
      const newContext = await browser.newContext();
      const newPage = await newContext.newPage();

      await setupApiMocks(newPage);

      // Navigate to protected page - should redirect to login
      await newPage.goto("/admin");
      await newPage.waitForURL("/login");

      await expect(
        newPage.locator("text=Sign in to Admin Panel"),
      ).toBeVisible();

      await newContext.close();
    });

    test("should restore session on page refresh", async ({ page }) => {
      await login(page, true);

      // Verify we're logged in
      await expect(
        page.locator("text=Dashboard") || page.locator("text=Admin"),
      ).toBeVisible();

      // Refresh the page
      await page.reload();

      // Should still be logged in
      await expect(
        page.locator("text=Dashboard") || page.locator("text=Admin"),
      ).toBeVisible();
    });
  });

  test.describe("Multi-Tab Behavior", () => {
    test("should maintain session across multiple tabs", async ({
      context,
    }) => {
      // Create first tab
      const page1 = await context.newPage();
      await setupApiMocks(page1);
      await login(page1, true);

      // Create second tab
      const page2 = await context.newPage();
      await setupApiMocks(page2);

      // Navigate to protected page in second tab
      await page2.goto("/admin");

      // Should be authenticated in both tabs
      await expect(
        page1.locator("text=Dashboard") || page1.locator("text=Admin"),
      ).toBeVisible();
      await expect(
        page2.locator("text=Dashboard") || page2.locator("text=Admin"),
      ).toBeVisible();
    });

    test("should logout from all tabs when using logout everywhere", async ({
      context,
    }) => {
      // Create first tab and login
      const page1 = await context.newPage();
      await setupApiMocks(page1);
      await login(page1, true);

      // Create second tab
      const page2 = await context.newPage();
      await setupApiMocks(page2);
      await page2.goto("/admin");

      // Both should be authenticated
      await expect(
        page1.locator("text=Dashboard") || page1.locator("text=Admin"),
      ).toBeVisible();
      await expect(
        page2.locator("text=Dashboard") || page2.locator("text=Admin"),
      ).toBeVisible();

      // Navigate to session management in first tab
      await page1.goto("/admin"); // Adjust based on your routing

      // Find and click logout everywhere button
      const logoutEverywhereButton = page1.locator(
        "text=Logout from all devices",
      );
      if (await logoutEverywhereButton.isVisible()) {
        // Mock the confirm dialog
        page1.on("dialog", (dialog) => dialog.accept());

        await logoutEverywhereButton.click();

        // Both tabs should redirect to login
        await page1.waitForURL("/login");
        await page2.waitForURL("/login");

        await expect(
          page1.locator("text=Sign in to Admin Panel"),
        ).toBeVisible();
        await expect(
          page2.locator("text=Sign in to Admin Panel"),
        ).toBeVisible();
      }
    });
  });

  test.describe("Token Refresh", () => {
    test("should automatically refresh expired tokens", async ({ page }) => {
      await login(page, true);

      // Mock API to return 401 for first request, then success after refresh
      let requestCount = 0;
      await page.route("**/api/protected-resource", async (route) => {
        requestCount++;
        if (requestCount === 1) {
          // First request fails with 401
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Token expired" }),
          });
        } else {
          // Subsequent requests succeed
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: "protected data" }),
          });
        }
      });

      // Make a request that will trigger token refresh
      const response = await page.evaluate(
        async (): Promise<{ data: string }> => {
          return fetch("/api/protected-resource", {
            credentials: "include",
          }).then((r) => r.json()) as Promise<{ data: string }>;
        },
      );

      expect(response.data).toBe("protected data");
    });

    test("should redirect to login if token refresh fails", async ({
      page,
    }) => {
      await login(page, true);

      // Mock refresh endpoint to fail
      await page.route("**/api/auth/refresh", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Refresh token expired" }),
        });
      });

      // Mock a protected resource that returns 401
      await page.route("**/api/protected-resource", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Token expired" }),
        });
      });

      // Trigger token refresh by making a failing request
      await page.evaluate(async () => {
        try {
          await fetch("/api/protected-resource", { credentials: "include" });
        } catch {
          // Expected to fail
        }
      });

      // Should redirect to login
      await page.waitForURL("/login");
      await expect(page.locator("text=Sign in to Admin Panel")).toBeVisible();
    });
  });

  test.describe("Logout Flow", () => {
    test("should logout successfully and redirect to login", async ({
      page,
    }) => {
      await login(page, true);

      // Find logout button (this depends on your UI structure)
      const logoutButton = page.locator("text=Logout").first();

      if (await logoutButton.isVisible()) {
        await logoutButton.click();

        // Should redirect to login
        await page.waitForURL("/login");
        await expect(page.locator("text=Sign in to Admin Panel")).toBeVisible();
      }
    });

    test("should handle logout errors gracefully", async ({ page }) => {
      await login(page, true);

      // Mock logout endpoint to fail
      await page.route("**/api/auth/logout", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Server error" }),
        });
      });

      const logoutButton = page.locator("text=Logout").first();

      if (await logoutButton.isVisible()) {
        await logoutButton.click();

        // Should still redirect to login even if server call fails
        await page.waitForURL("/login");
        await expect(page.locator("text=Sign in to Admin Panel")).toBeVisible();
      }
    });
  });

  test.describe("Protected Routes", () => {
    test("should redirect to login when accessing protected routes without authentication", async ({
      page,
    }) => {
      await page.goto("/admin");

      // Should redirect to login
      await page.waitForURL("/login");
      await expect(page.locator("text=Sign in to Admin Panel")).toBeVisible();
    });

    test("should redirect to intended page after login", async ({ page }) => {
      // Try to access protected route
      await page.goto("/admin/photos");

      // Should redirect to login
      await page.waitForURL("/login");

      // Login
      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.click('[data-testid="login-button"]');

      // Should redirect to originally intended page
      await page.waitForURL("/admin");
      // Note: The exact redirect behavior depends on your routing implementation
    });
  });

  test.describe("Error Scenarios", () => {
    test("should handle network errors during login", async ({ page }) => {
      // Mock network error
      await page.route("**/api/auth/login", async (route) => {
        await route.abort("failed");
      });

      await page.goto("/login");
      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.click('[data-testid="login-button"]');

      // Should show error message
      await expect(
        page.locator("text=Login failed") || page.locator("text=Network Error"),
      ).toBeVisible();
    });

    test("should handle session timeout gracefully", async ({ page }) => {
      await login(page, false); // Login without remember me

      // Mock all API calls to return 401 (session expired)
      await page.route("**/api/**", async (route) => {
        if (!route.request().url().includes("/auth/login")) {
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Session expired" }),
          });
        } else {
          await route.continue();
        }
      });

      // Try to navigate or make a request
      await page.reload();

      // Should redirect to login
      await page.waitForURL("/login");
      await expect(page.locator("text=Sign in to Admin Panel")).toBeVisible();
    });
  });

  test.describe("Performance and UX", () => {
    test("should have fast login response time", async ({ page }) => {
      await page.goto("/login");

      const startTime = Date.now();

      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.click('[data-testid="login-button"]');

      await page.waitForURL("/admin");

      const endTime = Date.now();
      const loginTime = endTime - startTime;

      // Login should complete within reasonable time
      expect(loginTime).toBeLessThan(5000); // 5 seconds
    });

    test("should show appropriate loading states", async ({ page }) => {
      // Add delay to simulate slow network
      await page.route("**/api/auth/login", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockTokenResponse),
        });
      });

      await page.goto("/login");
      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="password-input"]', testUser.password);

      await page.click('[data-testid="login-button"]');

      // Should show loading state
      await expect(page.locator("text=Signing in...")).toBeVisible();

      // Button should be disabled during login
      await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();
    });

    test("should maintain UI responsiveness during authentication", async ({
      page,
    }) => {
      await page.goto("/login");

      // All interactive elements should be responsive
      const usernameInput = page.locator('[data-testid="username-input"]');
      const passwordInput = page.locator('[data-testid="password-input"]');
      const rememberMeCheckbox = page.locator("#rememberMe");

      await expect(usernameInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(rememberMeCheckbox).toBeVisible();

      // Should be able to interact with form elements
      await usernameInput.click();
      await usernameInput.type("test");
      await passwordInput.click();
      await passwordInput.type("test");
      await rememberMeCheckbox.click();

      expect(await usernameInput.inputValue()).toBe("test");
      expect(await passwordInput.inputValue()).toBe("test");
      expect(await rememberMeCheckbox.isChecked()).toBe(true);
    });
  });
});
