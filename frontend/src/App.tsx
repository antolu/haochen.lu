import { useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { useAuthStore } from "./stores/authStore";
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import { UploadQueue } from "./components/UploadQueue";
import { useUploadProcessor } from "./hooks/useUploadProcessor";

// Public pages
import HomePage from "./pages/HomePage";
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
const AdminProjects = lazy(() => import("./pages/admin/AdminProjects"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog"));
const AdminEquipmentAliases = lazy(
  () => import("./pages/admin/AdminEquipmentAliases"),
);
const AdminApplications = lazy(() => import("./pages/admin/AdminApplications"));
const AdminAppImport = lazy(() => import("./pages/admin/AdminAppImport"));
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

// Component that uses hooks requiring QueryClient
const AppContent: React.FC = () => {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  // Initialize upload processor (runs in background)
  useUploadProcessor();

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  return (
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
          {/* Redirect /login to /admin which now handles the Authelia jump */}
          <Route path="/login" element={<Navigate to="/admin" replace />} />

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
              path="applications"
              element={
                <Suspense fallback={<AdminLoadingFallback />}>
                  <AdminApplications />
                </Suspense>
              }
            />
            <Route
              path="applications/import"
              element={
                <Suspense fallback={<AdminLoadingFallback />}>
                  <AdminAppImport />
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

        {/* Global upload queue */}
        <UploadQueue />
      </div>
    </Router>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
