import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { useAuthStore } from './stores/authStore';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';

// Public pages
import HomePage from './pages/HomePage';
import PhotographyPage from './pages/PhotographyPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import LoginPage from './pages/LoginPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPhotos from './pages/admin/AdminPhotos';
import AdminProjects from './pages/admin/AdminProjects';
import AdminBlog from './pages/admin/AdminBlog';
import AdminCameraAliases from './pages/admin/AdminCameraAliases';
import AdminLensAliases from './pages/admin/AdminLensAliases';
import AdminSubApps from './pages/admin/AdminSubApps';
import AdminSubAppIntegration from './pages/admin/AdminSubAppIntegration';
import AdminContent from './pages/admin/AdminContent';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const checkAuth = useAuthStore(state => state.checkAuth);

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
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:slug" element={<ProjectDetailPage />} />
              <Route path="blog" element={<BlogPage />} />
              <Route path="blog/:slug" element={<BlogPostPage />} />
            </Route>

            {/* Full-screen album route (no layout) */}
            <Route path="/photography" element={<PhotographyPage />} />

            {/* Auth routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="photos" element={<AdminPhotos />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="camera-aliases" element={<AdminCameraAliases />} />
              <Route path="lens-aliases" element={<AdminLensAliases />} />
              <Route path="subapps" element={<AdminSubApps />} />
              <Route path="subapps/integrate" element={<AdminSubAppIntegration />} />
              <Route path="content" element={<AdminContent />} />
            </Route>
          </Routes>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
