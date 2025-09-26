import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { useAuthStore } from "./stores/authStore";
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";

// Public pages
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";

// Lazy-loaded public pages (heavy components)
const PhotographyPage = lazy(() => import("./pages/PhotographyPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));

// Lazy-loaded Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminPhotos = lazy(() => import("./pages/admin/AdminPhotos"));
const AdminProfilePictures = lazy(
  () => import("./pages/admin/AdminProfilePictures"),
);
const AdminHeroImages = lazy(() => import("./pages/admin/AdminHeroImages"));
const AdminProjects = lazy(() => import("./pages/admin/AdminProjects"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog"));
const AdminEquipmentAliases = lazy(
  () => import("./pages/admin/AdminEquipmentAliases"),
);
const AdminSubApps = lazy(() => import("./pages/admin/AdminSubApps"));
const AdminSubAppIntegration = lazy(
  () => import("./pages/admin/AdminSubAppIntegration"),
);
const AdminContent = lazy(() => import("./pages/admin/AdminContent"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback for admin pages
const AdminLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-gray-600">Loading admin panel...</p>
    </div>
  </div>
);

// Loading fallback for public pages
const PageLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route
                path="projects"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <ProjectsPage />
                  </Suspense>
                }
              />
              <Route
                path="projects/:slug"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <ProjectDetailPage />
                  </Suspense>
                }
              />
              <Route
                path="blog"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <BlogPage />
                  </Suspense>
                }
              />
              <Route
                path="blog/:slug"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <BlogPostPage />
                  </Suspense>
                }
              />
            </Route>

            {/* Full-screen album route (no layout) */}
            <Route
              path="/photography"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <PhotographyPage />
                </Suspense>
              }
            />

            {/* Auth routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route
                index
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminDashboard />
                  </Suspense>
                }
              />
              <Route
                path="photos"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminPhotos />
                  </Suspense>
                }
              />
              <Route
                path="profile-pictures"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminProfilePictures />
                  </Suspense>
                }
              />
              <Route
                path="hero-images"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminHeroImages />
                  </Suspense>
                }
              />
              <Route
                path="projects"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminProjects />
                  </Suspense>
                }
              />
              <Route
                path="blog"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminBlog />
                  </Suspense>
                }
              />
              <Route
                path="equipment-aliases"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminEquipmentAliases />
                  </Suspense>
                }
              />
              <Route
                path="settings"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminSettings />
                  </Suspense>
                }
              />
              {/* Backward compatibility redirects */}
              <Route
                path="camera-aliases"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminEquipmentAliases />
                  </Suspense>
                }
              />
              <Route
                path="lens-aliases"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminEquipmentAliases />
                  </Suspense>
                }
              />
              <Route
                path="subapps"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminSubApps />
                  </Suspense>
                }
              />
              <Route
                path="subapps/integrate"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminSubAppIntegration />
                  </Suspense>
                }
              />
              <Route
                path="content"
                element={
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminContent />
                  </Suspense>
                }
              />
            </Route>

            {/* 404 Catch-all route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#363636",
                color: "#fff",
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
