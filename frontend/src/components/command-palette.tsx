import * as React from "react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Command, CommandList, CommandGroup, CommandItem } from "./ui/command";
import { Dialog, DialogContent } from "./ui/dialog";
import {
  Camera,
  FolderOpen,
  PenTool,
  FileText,
  User,
  Layers,
  Search,
  Zap,
  LayoutDashboard,
} from "lucide-react";
import { Badge } from "./ui/badge";

interface PaletteCommand {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords?: string[];
  badge?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const goTo = React.useCallback(
    (path: string) => {
      void navigate(path);
    },
    [navigate],
  );

  const commands = React.useMemo<PaletteCommand[]>(
    () => [
      {
        id: "nav-dashboard",
        title: "Dashboard",
        description: "Quick overview of metrics",
        icon: LayoutDashboard,
        action: () => {
          goTo("/admin");
        },
        keywords: ["home", "overview", "stats"],
      },
      {
        id: "nav-photos",
        title: "Photos",
        description: "Manage photos and gallery",
        icon: Camera,
        action: () => {
          goTo("/admin/photos");
        },
        keywords: ["images", "gallery", "upload"],
      },
      {
        id: "nav-projects",
        title: "Projects",
        description: "Manage projects and portfolio",
        icon: FolderOpen,
        action: () => {
          goTo("/admin/projects");
        },
        keywords: ["portfolio", "work", "showcase"],
      },
      {
        id: "nav-blog",
        title: "Blog",
        description: "Write and manage blog posts",
        icon: PenTool,
        action: () => {
          goTo("/admin/blog");
        },
        keywords: ["posts", "articles", "write"],
      },
      {
        id: "nav-content",
        title: "Content",
        description: "Edit website content",
        icon: FileText,
        action: () => {
          goTo("/admin/content");
        },
        keywords: ["text", "copy", "pages"],
      },
      {
        id: "nav-profile-pictures",
        title: "Profile Pictures",
        description: "Manage profile images",
        icon: User,
        action: () => {
          goTo("/admin/profile-pictures");
        },
        keywords: ["avatar", "user", "profile"],
      },
      {
        id: "nav-subapps",
        title: "Sub-Apps",
        description: "Manage sub-applications",
        icon: Layers,
        action: () => {
          goTo("/admin/subapps");
        },
        keywords: ["apps", "integrations", "settings"],
      },
      {
        id: "action-upload",
        title: "Upload Photos",
        description: "Quick upload new photos",
        icon: Camera,
        action: () => {
          goTo("/admin/photos");
        },
        keywords: ["add", "new", "upload"],
        badge: "Quick",
      },
      {
        id: "action-new-project",
        title: "New Project",
        description: "Create a new project",
        icon: FolderOpen,
        action: () => {
          goTo("/admin/projects");
        },
        keywords: ["create", "add", "new"],
        badge: "Quick",
      },
      {
        id: "action-new-post",
        title: "New Blog Post",
        description: "Write a new blog post",
        icon: PenTool,
        action: () => {
          goTo("/admin/blog");
        },
        keywords: ["write", "create", "article"],
        badge: "Quick",
      },
    ],
    [goTo],
  );

  const filteredCommands = React.useMemo(() => {
    if (!search) return commands;

    const searchLower = search.toLowerCase();
    return commands.filter((command) => {
      const titleMatch = command.title.toLowerCase().includes(searchLower);
      const descriptionMatch = command.description
        ?.toLowerCase()
        .includes(searchLower);
      const keywordMatch = command.keywords?.some((keyword) =>
        keyword.toLowerCase().includes(searchLower),
      );
      return (
        titleMatch ||
        Boolean(descriptionMatch) ||
        Boolean(keywordMatch ?? false)
      );
    });
  }, [search, commands]);

  const navigationCommands = filteredCommands.filter((cmd) =>
    cmd.id.startsWith("nav-"),
  );
  const quickActions = filteredCommands.filter((cmd) =>
    cmd.id.startsWith("action-"),
  );

  const handleSelect = (command: PaletteCommand) => {
    command.action();
    onOpenChange(false);
    setSearch("");
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl">
        <Command className="border-0">
          <div className="flex items-center border-b px-4 py-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search commands... (⌘K)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <CommandList className="max-h-80 p-2">
            <AnimatePresence mode="wait">
              {filteredCommands.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  No results found.
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2"
                >
                  {navigationCommands.length > 0 && (
                    <CommandGroup heading="Navigation">
                      {navigationCommands.map((command) => {
                        const Icon = command.icon;
                        return (
                          <CommandItem
                            key={command.id}
                            onSelect={() => handleSelect(command)}
                            className="flex items-center gap-3 p-3 cursor-pointer rounded-lg hover:bg-accent"
                          >
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {command.title}
                                </span>
                                {command.badge && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {command.badge}
                                  </Badge>
                                )}
                              </div>
                              {command.description && (
                                <div className="text-sm text-muted-foreground truncate">
                                  {command.description}
                                </div>
                              )}
                            </div>
                            <Zap className="h-3 w-3 opacity-50" />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}

                  {quickActions.length > 0 && (
                    <CommandGroup heading="Quick Actions">
                      {quickActions.map((command) => {
                        const Icon = command.icon;
                        return (
                          <CommandItem
                            key={command.id}
                            onSelect={() => handleSelect(command)}
                            className="flex items-center gap-3 p-3 cursor-pointer rounded-lg hover:bg-accent"
                          >
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {command.title}
                                </span>
                                {command.badge && (
                                  <Badge className="text-xs bg-gradient-to-r from-blue-500 to-purple-600">
                                    {command.badge}
                                  </Badge>
                                )}
                              </div>
                              {command.description && (
                                <div className="text-sm text-muted-foreground truncate">
                                  {command.description}
                                </div>
                              )}
                            </div>
                            <Zap className="h-3 w-3 opacity-50" />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CommandList>

          {/* Footer */}
          <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/50">
            <div className="flex items-center justify-between">
              <span>Press ⌘K to open command palette</span>
              <span>↑↓ to navigate • ↵ to select • esc to close</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
