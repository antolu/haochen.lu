import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { useAuthStore } from "../stores/authStore";
import type { LoginRequest } from "../types";

interface LoginFormData extends LoginRequest {
  rememberMe: boolean;
}

const LoginPage: React.FC = () => {
  const location = useLocation();
  const {
    login,
    isAuthenticated,
    error,
    clearError,
    isLoading: authLoading,
  } = useAuthStore();
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  // Use auth store loading state or local loading state
  const isLoading = authLoading || isLocalLoading;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const from =
    (location.state &&
    typeof location.state === "object" &&
    "from" in location.state
      ? (location.state as { from?: { pathname?: string } }).from?.pathname
      : undefined) ?? "/admin";

  // Clear local loading state when authentication state changes
  useEffect(() => {
    if (isAuthenticated || error) {
      setIsLocalLoading(false);
    }
  }, [isAuthenticated, error]);

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setIsLocalLoading(true);
    clearError();

    try {
      // Set a timeout to prevent hanging login attempts
      const loginPromise = login(data, data.rememberMe);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Login timeout")), 30000),
      );

      await Promise.race([loginPromise, timeoutPromise]);
      toast.success("Login successful!");
    } catch (error: unknown) {
      let errorMessage = "Login failed";

      const axiosError = error as AxiosError<{ detail?: string }>;
      const message = (error as Error).message;

      if (message === "Login timeout") {
        errorMessage = "Login request timed out. Please try again.";
      } else if (axiosError?.response?.data?.detail) {
        errorMessage = axiosError.response.data.detail ?? errorMessage;
      } else if (axiosError?.response?.status === 401) {
        errorMessage = "Invalid username or password";
      } else if (axiosError?.response?.status === 403) {
        errorMessage = "Access denied";
      } else if ((axiosError?.response?.status ?? 0) >= 500) {
        errorMessage = "Server error. Please try again later.";
      }

      toast.error(errorMessage);
    } finally {
      // Always reset loading state, even on errors or timeouts
      setIsLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full space-y-8"
      >
        <div>
          <h2 className="mt-6 text-center text-3xl font-serif font-bold text-foreground">
            Sign in to Admin Panel
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Access the content management system
          </p>
        </div>

        <form
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            void handleSubmit((d) => onSubmit(d))(e);
          }}
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className={`relative block w-full px-3 py-2 border rounded-md bg-white dark:bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring sm:text-sm ${
                  errors.username ? "border-destructive" : "border-border/40"
                }`}
                placeholder="Enter your username"
                {...register("username", { required: "Username is required" })}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={`relative block w-full px-3 py-2 border rounded-md bg-white dark:bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring sm:text-sm ${
                  errors.password ? "border-destructive" : "border-border/40"
                }`}
                placeholder="Enter your password"
                {...register("password", { required: "Password is required" })}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="rememberMe"
              type="checkbox"
              className="h-4 w-4 text-primary focus:ring-ring border-border/40 rounded bg-white dark:bg-background"
              {...register("rememberMe")}
            />
            <label
              htmlFor="rememberMe"
              className="ml-2 block text-sm text-foreground"
            >
              Keep me logged in for 30 days
            </label>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
              <div className="text-sm text-destructive">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="spinner mr-2"></div>
                  Signing in...
                </div>
              ) : (
                "Sign in"
              )}
            </button>
          </div>

          <div className="text-center">
            <a
              href="/"
              className="text-primary hover:text-primary/80 text-sm font-medium"
            >
              ← Back to home
            </a>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default LoginPage;
