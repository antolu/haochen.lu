import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Camera,
  FolderOpen,
  PenTool,
  Eye,
  Sparkles,
  Upload,
  Settings,
  FileText,
  ArrowUpRight,
} from "lucide-react";

import { photos, projects, blog, heroImages } from "../../api/client";
import { Link } from "react-router-dom";
import type { PhotoStatsSummary, ProjectStatsSummary } from "../../types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
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
      gradient: "from-purple-500/10 via-indigo-500/10 to-purple-600/10",
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      borderGlow: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
    },
    {
      name: "Featured Photos",
      stat: photoStats?.featured_photos ?? 0,
      icon: Eye,
      gradient: "from-emerald-500/10 via-teal-500/10 to-emerald-600/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
      borderGlow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    },
    {
      name: "Hero Images",
      stat: heroImagesList?.length ?? 0,
      icon: Sparkles,
      gradient: "from-amber-500/10 via-orange-500/10 to-amber-600/10",
      iconColor: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
      borderGlow: "shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    },
    {
      name: "Projects",
      stat: projectStats?.total_projects ?? 0,
      icon: FolderOpen,
      gradient: "from-blue-500/10 via-cyan-500/10 to-blue-600/10",
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      borderGlow: "shadow-[0_0_15px_rgba(59,130,246,0.15)]",
    },
    {
      name: "Blog Posts",
      stat: blogStats?.total_posts ?? 0,
      icon: PenTool,
      gradient: "from-rose-500/10 via-pink-500/10 to-rose-600/10",
      iconColor: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-950/30",
      borderGlow: "shadow-[0_0_15px_rgba(244,63,94,0.15)]",
    },
  ];

  const quickActions = [
    {
      title: "Upload Photos",
      description: "Add new photos to gallery",
      icon: Upload,
      href: "/admin/photos",
      gradient: "from-blue-500/10 to-cyan-500/10",
    },
    {
      title: "Hero Images",
      description: "Manage homepage hero images",
      icon: Sparkles,
      href: "/admin/hero-images",
      gradient: "from-indigo-500/10 to-purple-500/10",
    },
    {
      title: "Manage Projects",
      description: "Add or edit projects",
      icon: FolderOpen,
      href: "/admin/projects",
      gradient: "from-orange-500/10 to-amber-500/10",
    },
    {
      title: "Write Blog Post",
      description: "Create new blog content",
      icon: PenTool,
      href: "/admin/blog",
      gradient: "from-violet-500/10 to-purple-500/10",
    },
    {
      title: "Edit Content",
      description: "Update website text content",
      icon: FileText,
      href: "/admin/content",
      gradient: "from-green-500/10 to-emerald-500/10",
    },
    {
      title: "Settings",
      description: "Manage system settings",
      icon: Settings,
      href: "/admin/settings",
      gradient: "from-gray-500/10 to-slate-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-xl">
          Welcome back! Here's an overview of your content.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {stats.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              whileHover={{ y: -4 }}
            >
              <Card
                className={`relative overflow-hidden bg-gradient-to-br ${item.gradient} border-border/30 hover:border-border/60 hover:${item.borderGlow} transition-all duration-300 group`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                        {item.name}
                      </p>
                      <p className="text-4xl font-bold tracking-tight">
                        {formatNumber(item.stat)}
                      </p>
                    </div>
                    <div
                      className={`p-3.5 rounded-xl ${item.bgColor} group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className={`h-6 w-6 ${item.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl">Quick Actions</CardTitle>
          <CardDescription className="text-base">
            Jump to commonly used admin functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.06 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Link to={action.href} className="h-full">
                    <Card
                      className={`h-full group cursor-pointer bg-gradient-to-br ${action.gradient} hover:shadow-xl hover:border-primary/20 transition-all duration-300 border-border/30`}
                    >
                      <CardContent className="p-7 h-full">
                        <div className="flex items-start gap-4 h-full">
                          <div className="p-3 rounded-xl bg-background/70 backdrop-blur-sm group-hover:bg-background/90 transition-colors flex-shrink-0">
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1 space-y-1.5 min-h-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-base">
                                {action.title}
                              </h3>
                              <ArrowUpRight className="h-5 w-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {action.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
