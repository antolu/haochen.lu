import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, User, Sparkles } from "lucide-react";
import ContentManager from "../../components/admin/ContentManager";
import ProfilePictureManager from "../../components/admin/ProfilePictureManager";
import HeroImageManager from "../../components/admin/HeroImageManager";
import { AdminPageLayout } from "../../components/admin/AdminPageLayout";
import { cn } from "../../lib/utils";

type ContentTab = "content" | "profile" | "hero";

const AdminContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ContentTab>("content");

  const tabs = [
    { id: "content" as const, label: "Text Content", icon: FileText },
    { id: "profile" as const, label: "Profile Pictures", icon: User },
    { id: "hero" as const, label: "Hero Images", icon: Sparkles },
  ];

  return (
    <AdminPageLayout
      title="Website Content"
      description="Manage your profile, hero images, and all editable text"
      actions={
        <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                )}
              >
                <Icon
                  className={cn("h-4 w-4", isActive ? "text-primary" : "")}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      }
    >
      <div>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "content" && <ContentManager />}
            {activeTab === "profile" && <ProfilePictureManager />}
            {activeTab === "hero" && <HeroImageManager />}
          </motion.div>
        </AnimatePresence>
      </div>
    </AdminPageLayout>
  );
};

export default AdminContent;
