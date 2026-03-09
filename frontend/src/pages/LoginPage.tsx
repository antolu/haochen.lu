import React, { useState, useEffect } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import type { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, LogIn } from "lucide-react";

import { useAuthStore } from "../stores/authStore";
import type { LoginRequest } from "../types";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md w-full"
      >
        <Card className="glass border-border/40 shadow-2xl overflow-hidden">
          <CardHeader className="space-y-1 pb-6 pt-10 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border border-primary/20"
            >
              <LogIn className="w-8 h-8 text-primary shadow-glow-sm" />
            </motion.div>
            <CardTitle className="text-3xl font-serif font-bold tracking-tight text-foreground">
              Admin Gateway
            </CardTitle>
            <CardDescription className="text-muted-foreground/80 font-medium">
              Enter your credentials to manage your portfolio
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              className="space-y-6"
              onSubmit={(e) => {
                void handleSubmit((d) => onSubmit(d))(e);
              }}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. administrator"
                    {...register("username", {
                      required: "Username is required",
                    })}
                    className={
                      errors.username
                        ? "border-destructive focus-visible:border-destructive"
                        : ""
                    }
                  />
                  {errors.username && (
                    <p className="text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register("password", {
                      required: "Password is required",
                    })}
                    className={
                      errors.password
                        ? "border-destructive focus-visible:border-destructive"
                        : ""
                    }
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="rememberMe"
                  type="checkbox"
                  className="h-4 w-4 rounded border-border/50 bg-background text-primary ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors cursor-pointer accent-primary"
                  {...register("rememberMe")}
                />
                <Label
                  htmlFor="rememberMe"
                  className="text-sm font-medium leading-none cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                >
                  Keep me logged in for 30 days
                </Label>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-lg bg-destructive/10 p-3 border border-destructive/20"
                >
                  <p className="text-sm text-destructive font-medium text-center">
                    {error}
                  </p>
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 text-base font-semibold transition-all duration-300 shadow-glow-sm hover:shadow-glow"
                variant="gradient"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pb-10 pt-4">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground/60 font-semibold tracking-wider">
                  Navigation
                </span>
              </div>
            </div>
            <Link
              to="/"
              className="group flex items-center justify-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors gap-2"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Return to Gallery
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginPage;
