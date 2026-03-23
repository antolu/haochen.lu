import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, LogIn } from "lucide-react";

import { ThemeProvider } from "../components/theme-provider";
import { auth } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

const LoginPage: React.FC = () => {
  const location = useLocation();
  const {
    isAuthenticated,
    error,
    clearError,
    isLoading: authLoading,
    checkAuth,
  } = useAuthStore();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const next =
    query.get("next") ||
    (location.state &&
    typeof location.state === "object" &&
    "from" in location.state
      ? (location.state as { from?: { pathname?: string } }).from?.pathname
      : undefined) ||
    "/admin";
  const clientId = query.get("client_id");
  const redirectUri = query.get("redirect_uri");
  const responseType = query.get("response_type") || "code";
  const state = query.get("state");

  useEffect(() => {
    if (!isAuthenticated) {
      void checkAuth();
    }
  }, [checkAuth, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !clientId || !redirectUri || !state) {
      return;
    }

    let isMounted = true;
    const authorize = async () => {
      try {
        setIsRedirecting(true);
        const { url } = await auth.authorize({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: responseType,
          state,
        });
        if (isMounted) {
          window.location.assign(url);
        }
      } catch {
        if (isMounted) {
          toast.error("Failed to continue to the sub-application");
          setIsRedirecting(false);
        }
      }
    };

    void authorize();
    return () => {
      isMounted = false;
    };
  }, [clientId, isAuthenticated, redirectUri, responseType, state]);

  const handleLogin = async (): Promise<void> => {
    clearError();
    setIsRedirecting(true);
    try {
      await auth.login({
        next,
        client_id: clientId ?? undefined,
        redirect_uri: redirectUri ?? undefined,
        response_type: clientId ? responseType : undefined,
        state: state ?? undefined,
      });
    } catch {
      setIsRedirecting(false);
      toast.error("Failed to start login");
    }
  };

  if (isAuthenticated && !clientId) {
    return <Navigate to={next} replace />;
  }

  const isLoading = authLoading || isRedirecting;
  const heading = clientId ? "Portfolio SSO" : "Portfolio Login";
  const description = clientId
    ? "Sign in once and continue to your sub-application."
    : "Use Casdoor SSO to access the admin area.";

  return (
    <ThemeProvider defaultTheme="system" storageKey="admin-ui-theme">
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 text-foreground transition-colors duration-300">
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
                {heading}
              </CardTitle>
              <CardDescription className="text-muted-foreground/80 font-medium">
                {description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                  <p className="text-sm text-destructive font-medium text-center">
                    {error}
                  </p>
                </div>
              )}

              <Button
                type="button"
                disabled={isLoading}
                className="w-full h-11 text-base font-semibold transition-all duration-300 shadow-glow-sm hover:shadow-glow"
                variant="gradient"
                onClick={() => {
                  void handleLogin();
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  "Continue with Casdoor"
                )}
              </Button>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pb-10 pt-4">
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
    </ThemeProvider>
  );
};

export default LoginPage;
