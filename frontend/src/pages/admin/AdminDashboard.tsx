import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Camera,
  FolderOpen,
  PenTool,
  FileText,
  Eye,
  Sparkles,
  Upload,
  Settings,
  BarChart3,
} from "lucide-react";

import { photos, projects, blog, heroImages } from "../../api/client";
import { Link } from "react-router-dom";
import type { PhotoStatsSummary, ProjectStatsSummary } from "../../types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { formatNumber } from "../../lib/utils";

const AdminDashboard: React.FC = () => {
  const { data: photoStats } = useQuery<PhotoStatsSummary>({
    queryKey: ["admin", "photo-stats"],
    queryFn: photos.getStats,
  });

  const { data: projectStats } = useQuery<ProjectStatsSummary>({
    queryKey: ["admin", "project-stats"],
    queryFn: projects.getStats,
  });

  const { data: blogStats } = useQuery<{ total_posts: number }>({
    queryKey: ["admin", "blog-stats"],
    queryFn: blog.getStats,
  });

  const { data: heroImagesList } = useQuery({
    queryKey: ["admin", "hero-images"],
    queryFn: heroImages.list,
  });

  const stats = [
    {
      name: "Total Photos",
      stat: photoStats?.total_photos ?? 0,
      icon: Camera,
      gradient: "from-blue-500 to-cyan-500",
      change: null,
    },
    {
      name: "Featured Photos",
      stat: photoStats?.featured_photos ?? 0,
      icon: Eye,
      gradient: "from-emerald-500 to-teal-500",
      change: null,
    },
    {
      name: "Hero Images",
      stat: heroImagesList?.length ?? 0,
      icon: Sparkles,
      gradient: "from-purple-500 to-pink-500",
      change: null,
    },
    {
      name: "Projects",
      stat: projectStats?.total_projects ?? 0,
      icon: FolderOpen,
      gradient: "from-orange-500 to-red-500",
      change: null,
    },
    {
      name: "Blog Posts",
      stat: blogStats?.total_posts ?? 0,
      icon: PenTool,
      gradient: "from-violet-500 to-purple-500",
      change: null,
    },
  ];

  const quickActions = [
    {
      title: "Upload Photos",
      description: "Add new photos to gallery",
      icon: Upload,
      href: "/admin/photos",
    },
    {
      title: "Hero Images",
      description: "Manage homepage hero images",
      icon: Sparkles,
      href: "/admin/hero-images",
    },
    {
      title: "Manage Projects",
      description: "Add or edit projects",
      icon: FolderOpen,
      href: "/admin/projects",
    },
    {
      title: "Write Blog Post",
      description: "Create new blog content",
      icon: PenTool,
      href: "/admin/blog",
    },
    {
      title: "Edit Content",
      description: "Update website text content",
      icon: FileText,
      href: "/admin/content",
    },
    {
      title: "Settings",
      description: "Manage system settings",
      icon: Settings,
      href: "/admin/settings",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back! Here's what's happening.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1">
            <BarChart3 className="h-3 w-3 mr-1" />
            Analytics
          </Badge>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">
                          {formatNumber(item.stat)}
                        </span>
                        {item.change ? (
                          <Badge
                            variant="secondary"
                            className="text-xs px-1.5 py-0.5"
                          >
                            {item.change}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={`w-12 h-12 rounded-lg bg-gradient-to-r ${item.gradient} p-2.5 shadow-sm`}
                    >
                      <Icon className="h-full w-full text-white" />
                    </div>
                  </div>
                  <div
                    className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${item.gradient}`}
                  />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                >
                  <Button
                    asChild
                    variant="outline"
                    className="w-full h-auto p-4 justify-start"
                  >
                    <Link
                      to={action.href}
                      className="flex items-center gap-3 w-full"
                    >
                      <Icon className="h-6 w-6 flex-shrink-0" />
                      <div className="text-left min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {action.title}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {action.description}
                        </div>
                      </div>
                    </Link>
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity section removed per request */}
    </div>
  );
};

export default AdminDashboard;
