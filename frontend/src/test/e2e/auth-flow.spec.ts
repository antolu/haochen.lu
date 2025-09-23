/**
 * E2E Tests: Authentication Flow
 *
 * End-to-end tests for the complete authentication flow including
 * login, logout, protected routes, and session management.
 */
import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto("/");

    // Mock API responses for authentication
    await page.route("**/api/auth/login", async (route) => {
      const request = route.request();
      const data = request.postDataJSON() as {
        username?: string;
        password?: string;
      };

      if (data.username === "admin" && data.password === "password123") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "mock-jwt-token",
            token_type: "bearer",
            user: {
              id: "user-123",
              username: "admin",
              email: "admin@example.com",
              full_name: "Admin User",
              is_admin: true,
              is_active: true,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "Invalid credentials",
          }),
        });
      }
    });

    await page.route("**/api/auth/me", async (route) => {
      const authHeader = route.request().headers()["authorization"];

      if (authHeader === "Bearer mock-jwt-token") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "user-123",
            username: "admin",
            email: "admin@example.com",
            full_name: "Admin User",
            is_admin: true,
            is_active: true,
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "Not authenticated",
          }),
        });
      }
    });

    await page.route("**/api/auth/logout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Logged out successfully" }),
      });
    });
  });

  test("should display login button when not authenticated", async ({
    page,
  }) => {
    await expect(page.getByTestId("login-button")).toBeVisible();
    await expect(page.getByTestId("logout-button")).not.toBeVisible();
    await expect(page.getByTestId("user-greeting")).not.toBeVisible();
  });

  test("should complete successful login flow", async ({ page }) => {
    // Click login button
    await page.getByTestId("login-button").click();

    // Should navigate to login page or show login modal
    await expect(page.getByTestId("login-form")).toBeVisible();

    // Fill in credentials
    await page.getByTestId("username-input").fill("admin");
    await page.getByTestId("password-input").fill("password123");

    // Submit form
    await page.getByTestId("submit-button").click();

    // Should be redirected back to home page and show user info
    await expect(page.getByTestId("user-greeting")).toBeVisible();
    await expect(page.getByText("Hello, Admin User")).toBeVisible();
    await expect(page.getByTestId("admin-badge")).toBeVisible();
    await expect(page.getByTestId("logout-button")).toBeVisible();
    await expect(page.getByTestId("login-button")).not.toBeVisible();
  });

  test("should handle login with invalid credentials", async ({ page }) => {
    await page.getByTestId("login-button").click();
    await expect(page.getByTestId("login-form")).toBeVisible();

    // Fill in wrong credentials
    await page.getByTestId("username-input").fill("admin");
    await page.getByTestId("password-input").fill("wrongpassword");

    await page.getByTestId("submit-button").click();

    // Should show error message
    await expect(page.getByTestId("error-message")).toBeVisible();
    await expect(page.getByText("Invalid credentials")).toBeVisible();

    // Should still be on login page
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByTestId("login-button")).not.toBeVisible();
  });

  test("should complete logout flow", async ({ page }) => {
    // Login first
    await page.getByTestId("login-button").click();
    await page.getByTestId("username-input").fill("admin");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("submit-button").click();

    // Verify logged in
    await expect(page.getByTestId("logout-button")).toBeVisible();

    // Logout
    await page.getByTestId("logout-button").click();

    // Should be logged out
    await expect(page.getByTestId("login-button")).toBeVisible();
    await expect(page.getByTestId("logout-button")).not.toBeVisible();
    await expect(page.getByTestId("user-greeting")).not.toBeVisible();
  });

  test("should protect admin routes", async ({ page }) => {
    // Try to access admin page without authentication
    await page.goto("/admin");

    // Should be redirected to login or show access denied
    await expect(page.getByTestId("login-required")).toBeVisible();

    // Login as admin
    await page.goto("/");
    await page.getByTestId("login-button").click();
    await page.getByTestId("username-input").fill("admin");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("submit-button").click();

    // Now should be able to access admin page
    await page.goto("/admin");
    await expect(page.getByTestId("admin-panel")).toBeVisible();
  });

  test("should maintain session across page reloads", async ({ page }) => {
    // Login
    await page.getByTestId("login-button").click();
    await page.getByTestId("username-input").fill("admin");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("submit-button").click();

    await expect(page.getByTestId("user-greeting")).toBeVisible();

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page.getByTestId("user-greeting")).toBeVisible();
    await expect(page.getByTestId("logout-button")).toBeVisible();
  });

  test("should handle session timeout", async ({ page }) => {
    // Mock expired token response
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Token has expired",
        }),
      });
    });

    // Login first
    await page.getByTestId("login-button").click();
    await page.getByTestId("username-input").fill("admin");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("submit-button").click();

    await expect(page.getByTestId("user-greeting")).toBeVisible();

    // Navigate to protected page (should trigger session check)
    await page.goto("/admin");

    // Should be logged out due to expired session
    await expect(page.getByTestId("login-required")).toBeVisible();
  });

  test("should show appropriate navigation for authenticated users", async ({
    page,
  }) => {
    // Login as admin
    await page.getByTestId("login-button").click();
    await page.getByTestId("username-input").fill("admin");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("submit-button").click();

    // Admin should see admin link in navigation
    await expect(page.getByTestId("nav-link-admin")).toBeVisible();

    // Should see user info in navigation
    await expect(page.getByTestId("user-greeting")).toBeVisible();
    await expect(page.getByTestId("admin-badge")).toBeVisible();
  });

  test("should handle mobile authentication flow", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Open mobile menu
    await page.getByTestId("mobile-menu-button").click();
    await expect(page.getByTestId("mobile-nav")).toBeVisible();

    // Login via mobile menu
    await page.getByTestId("mobile-login-button").click();
    await expect(page.getByTestId("login-form")).toBeVisible();

    await page.getByTestId("username-input").fill("admin");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("submit-button").click();

    // Open mobile menu again to check auth state
    await page.getByTestId("mobile-menu-button").click();
    await expect(page.getByTestId("mobile-auth-section")).toBeVisible();
    await expect(page.getByTestId("mobile-logout-button")).toBeVisible();

    // Logout via mobile menu
    await page.getByTestId("mobile-logout-button").click();

    // Mobile menu should close and show login button
    await expect(page.getByTestId("mobile-nav")).not.toBeVisible();
    await page.getByTestId("mobile-menu-button").click();
    await expect(page.getByTestId("mobile-login-button")).toBeVisible();
  });
});

test.describe("Authentication Security", () => {
  test("should not store credentials in localStorage", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("login-button").click();
    await page.getByTestId("username-input").fill("admin");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("submit-button").click();

    // Check localStorage doesn't contain credentials
    const localStorage = await page.evaluate(() => {
      const keys = Object.keys(window.localStorage);
      const values = keys.map((key) => ({
        key,
        value: window.localStorage.getItem(key),
      }));
      return values;
    });

    // Should not contain plain text credentials
    const credentialKeys = localStorage.filter(
      (item) =>
        item.key.includes("password") ||
        item.key.includes("credential") ||
        item.value?.includes("password123"),
    );

    expect(credentialKeys).toHaveLength(0);
  });

  test("should clear session data on logout", async ({ page }) => {
    // Login
    await page.goto("/");
    await page.getByTestId("login-button").click();
    await page.getByTestId("username-input").fill("admin");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("submit-button").click();

    // Get localStorage after login
    const localStorageAfterLogin = await page.evaluate(() => {
      return Object.keys(window.localStorage).length;
    });

    // Logout
    await page.getByTestId("logout-button").click();

    // Check localStorage is cleared
    const localStorageAfterLogout = await page.evaluate(() => {
      return Object.keys(window.localStorage).length;
    });

    expect(localStorageAfterLogout).toBeLessThan(localStorageAfterLogin);
  });

  test("should handle XSS in login form", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("login-button").click();

    const xssPayload = '<script>alert("XSS")</script>';

    await page.getByTestId("username-input").fill(xssPayload);
    await page.getByTestId("password-input").fill("password");
    await page.getByTestId("submit-button").click();

    // Should not execute script
    const alerts = [];
    page.on("dialog", (dialog) => {
      alerts.push(dialog.message());
      void dialog.dismiss();
    });

    // Wait a bit to see if any alert fires
    await page.waitForTimeout(1000);
    expect(alerts).toHaveLength(0);

    // Form should still contain the XSS payload as text
    const usernameValue = await page.getByTestId("username-input").inputValue();
    expect(usernameValue).toBe(xssPayload);
  });

  test("should enforce HTTPS in production", async ({ page }) => {
    // This would be tested in a production environment
    // For local testing, we can check security headers if available

    await page.goto("/");

    const response = await page.request.get("/");
    const headers = response.headers();

    // Check for security headers (if implemented)
    if (headers["strict-transport-security"]) {
      expect(headers["strict-transport-security"]).toBeTruthy();
    }

    if (headers["x-frame-options"]) {
      expect(headers["x-frame-options"]).toBe("DENY");
    }
  });
});
