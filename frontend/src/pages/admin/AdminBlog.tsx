import React from "react";
import { AdminPageLayout } from "../../components/admin/AdminPageLayout";

const AdminBlog: React.FC = () => {
  return (
    <AdminPageLayout
      title="Blog Management"
      description="Create and manage your blog posts"
    >
      <div className="bg-muted/30 rounded-xl p-12 text-center">
        <p className="text-muted-foreground">
          Blog management interface coming soon...
        </p>
      </div>
    </AdminPageLayout>
  );
};

export default AdminBlog;
