import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, User, Sparkles } from "lucide-react";
import ContentManager from "../../components/admin/ContentManager";
import ProfilePictureManager from "../../components/admin/ProfilePictureManager";
import HeroImageManager from "../../components/admin/HeroImageManager";
import { AdminPageLayout } from "../../components/admin/AdminPageLayout";
import { SegmentedControl } from "../../components/admin/SegmentedControl";

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
        <SegmentedControl
          options={tabs.map((tab) => ({
            value: tab.id,
            label: tab.label,
            icon: tab.icon,
          }))}
          value={activeTab}
          onChange={setActiveTab}
        />
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
