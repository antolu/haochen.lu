import React from "react";

const AdminBlog: React.FC = () => {
  return (
    <div>
      <div className="mb-10 space-y-3">
        <h1 className="admin-page-title">Blog Management</h1>
        <p className="text-muted-foreground text-xl">
          Create and manage your blog posts
        </p>
      </div>

      <div className="bg-muted/30 rounded-xl p-12 text-center">
        <p className="text-muted-foreground">
          Blog management interface coming soon...
        </p>
      </div>
    </div>
  );
};

export default AdminBlog;
