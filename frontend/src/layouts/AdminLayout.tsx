import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Camera,
  FolderOpen,
  PenTool,
  Layers,
  FileText,
  LogOut,
  User,
  Menu,
  X,
  ChevronLeft,
  Moon,
  Sun,
  Laptop,
  Settings,
  Sparkles,
} from "lucide-react";

import { useAuthStore } from "../stores/authStore";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { ThemeProvider, useTheme } from "../components/theme-provider";
import { cn } from "../lib/utils";
import { CommandPalette } from "../components/command-palette";

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        if (theme === "light") setTheme("dark");
        else if (theme === "dark") setTheme("system");
        else setTheme("light");
      }}
      className="w-full justify-start"
    >
      {theme === "light" && <Sun className="h-4 w-4 mr-2" />}
      {theme === "dark" && <Moon className="h-4 w-4 mr-2" />}
      {theme === "system" && <Laptop className="h-4 w-4 mr-2" />}
      <span className="capitalize">{theme}</span>
    </Button>
  );
};

const AdminLayoutContent: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated, logout, checkAuth } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      void checkAuth();
    }
  }, [isAuthenticated, checkAuth]);

  if (!isAuthenticated || !user?.is_admin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const navigation = [
    {
      name: "Dashboard",
      href: "/admin",
      icon: Home,
      badge: null,
    },
    {
      name: "Photos",
      href: "/admin/photos",
      icon: Camera,
      badge: null, // photoStats?.total_photos?.toString() - removed for now
    },
    {
      name: "Profile Pictures",
      href: "/admin/profile-pictures",
      icon: User,
      badge: null,
    },
    {
      name: "Projects",
      href: "/admin/projects",
      icon: FolderOpen,
      badge: null,
    },
    {
      name: "Hero Images",
      href: "/admin/hero-images",
      icon: Sparkles,
      badge: null,
    },
    {
      name: "Blog",
      href: "/admin/blog",
      icon: PenTool,
      badge: null,
    },
    {
      name: "Equipment Aliases",
      href: "/admin/equipment-aliases",
      icon: Settings,
      badge: null,
    },
    {
      name: "Content",
      href: "/admin/content",
      icon: FileText,
      badge: null,
    },
    {
      name: "Sub-Apps",
      href: "/admin/subapps",
      icon: Layers,
      badge: null,
    },
    {
      name: "Settings",
      href: "/admin/settings",
      icon: Settings,
      badge: null,
    },
  ];

  // Badge stats would be fetched in a real app

  // isActive function removed - using inline logic in navigation items

  const handleLogout = () => {
    void logout();
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Layers className="h-4 w-4 text-white" />
          </div>
          {(!sidebarCollapsed || mobile) && (
            <span className="text-lg font-semibold">Admin</span>
          )}
        </Link>
        {!mobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform",
                sidebarCollapsed && "rotate-180",
              )}
            />
          </Button>
        )}
        {mobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-4 py-4">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => mobile && setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-primary text-primary-foreground shadow-sm",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {(!sidebarCollapsed || mobile) && (
                  <>
                    <span className="flex-1">{item.name}</span>
                    {item.badge && (
                      <Badge
                        variant="secondary"
                        className="ml-auto px-1.5 py-0.5 text-xs"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Theme Toggle */}
      <div className="p-4 space-y-2">
        {(!sidebarCollapsed || mobile) && <ThemeToggle />}

        {/* User info */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-xs font-medium text-white">
              {user.username.charAt(0).toUpperCase()}
            </span>
          </div>
          {(!sidebarCollapsed || mobile) && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.username}</p>
                <p className="text-xs text-muted-foreground">Administrator</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-8 w-8 p-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden md:flex flex-col bg-card/50 backdrop-blur-sm border-r transition-all duration-300",
            sidebarCollapsed ? "w-16" : "w-64",
          )}
        >
          <SidebarContent />
        </aside>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 md:hidden"
            >
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className="absolute left-0 top-0 h-full w-64 bg-card/95 backdrop-blur-sm"
              >
                <SidebarContent mobile />
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile Header */}
          <header className="md:hidden flex items-center justify-between p-4 border-b bg-card/50 backdrop-blur-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold">Admin Panel</h1>
            <div className="w-10" /> {/* Spacer */}
          </header>

          {/* Main Content Area */}
          <main className="flex-1 p-4 md:p-6 overflow-auto bg-card/30 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </div>
  );
};

const AdminLayout: React.FC = () => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="admin-ui-theme">
      <div className="min-h-screen bg-background text-foreground">
        <AdminLayoutContent />
      </div>
    </ThemeProvider>
  );
};

export default AdminLayout;
